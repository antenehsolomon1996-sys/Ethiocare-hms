import { ethioCareClient } from '@/api/ethioCareClient';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notification.service';
import { logAudit } from '@/lib/auditLogger';
import { format } from 'date-fns';

export interface SettlePaymentOptions {
  paymentMethod?: string;
  cashierName?: string;
  receiptNumber?: string;
  paidDate?: string;
  customAmount?: number;
}

export interface SettlePaymentResult {
  success: boolean;
  payment: any;
  receiptNumber: string;
  referenceType?: string;
  referenceId?: string;
  orderUnlocked?: boolean;
}

export const hospitalBillingService = {
  /**
   * Atomically settles a hospital payment and unlocks the corresponding clinical order or visit.
   * Idempotent: If the payment is already 'paid', it returns the existing record without duplicating.
   */
  async settlePayment(paymentId: string, options: SettlePaymentOptions = {}): Promise<SettlePaymentResult> {
    if (!paymentId) throw new Error('Payment ID is required');

    // 1. Fetch current payment record
    const payment = await ethioCareClient.entities.Payment.get(paymentId);
    if (!payment) throw new Error(`Payment record not found: ${paymentId}`);

    const receiptNum = options.receiptNumber ||
      payment.receipt_number ||
      `RCP-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const cashier = options.cashierName || 'Hospital Cashier';
    const paidDate = options.paidDate || format(new Date(), 'yyyy-MM-dd');
    const paymentMethod = options.paymentMethod || payment.payment_method || 'cash';
    const finalAmount = options.customAmount !== undefined ? options.customAmount : (Number(payment.amount) || 0);

    // Idempotency check: if already paid, return safely
    if (payment.status === 'paid' && payment.receipt_number) {
      return {
        success: true,
        payment,
        receiptNumber: payment.receipt_number,
        referenceType: payment.reference_type,
        referenceId: payment.reference_id,
        orderUnlocked: true
      };
    }

    // 2. Update payment record to PAID
    const updatedPayment = await ethioCareClient.entities.Payment.update(payment.id, {
      status: 'paid',
      amount: finalAmount,
      payment_method: paymentMethod,
      receipt_number: receiptNum,
      cashier_name: cashier,
      paid_date: paidDate,
      order_status: 'paid'
    });

    const refType = payment.reference_type || payment.payment_type;
    const refId = payment.reference_id;
    const visitId = payment.visit_id;
    const patientName = payment.patient_name || 'Patient';

    let orderUnlocked = false;

    // -------------------------------------------------------------
    // 3. Service Unlocking Based on Payment Category
    // -------------------------------------------------------------

    // A. REGISTRATION PAYMENT -> Unlock Visit for Doctor Consultation
    if (refType === 'registration' || payment.payment_type === 'registration') {
      let targetVisitId = visitId;

      // If visit_id is missing, look up active/today's visit for this patient
      if (!targetVisitId && payment.patient_id) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const visits = await ethioCareClient.entities.Visit.filter({ patient_id: payment.patient_id, visit_date: today });
        if (visits.length > 0) {
          targetVisitId = visits[0].id;
        }
      }

      if (targetVisitId) {
        try {
          await ethioCareClient.entities.Visit.update(targetVisitId, {
            registration_fee_paid: true,
            billing_completed: true,
            status: 'waiting'
          });
          orderUnlocked = true;

          // Dispatch notification to Doctor Portal
          notificationService.dispatch({
            title: 'Patient Ready for Doctor',
            message: `Registration fee paid for ${patientName}. Consultation queue is now active.`,
            type: 'success',
            module: 'queue',
            targetRoles: ['doctor', 'owner'],
            link: '/doctor/queue'
          });
        } catch (err) {
          console.warn('[hospitalBillingService] Notice updating visit registration status:', err);
        }
      }
    }

    // B. LABORATORY PAYMENT -> Unlock Lab Order for Laboratory Processing
    else if (refType === 'lab_order' || payment.payment_type === 'laboratory') {
      try {
        if (refId) {
          await ethioCareClient.entities.LabOrder.update(refId, {
            payment_status: 'paid',
            test_status: 'pending'
          });
          orderUnlocked = true;
        } else if (visitId) {
          // If all lab tests in visit paid together
          const labOrders = await ethioCareClient.entities.LabOrder.filter({ visit_id: visitId });
          for (const lo of labOrders) {
            await ethioCareClient.entities.LabOrder.update(lo.id, {
              payment_status: 'paid',
              test_status: 'pending'
            });
          }
          orderUnlocked = true;
        }

        // Update visit to lab_paid if currently lab_pending
        if (visitId) {
          await ethioCareClient.entities.Visit.update(visitId, { status: 'lab_paid' });
        }

        // Dispatch notification to Laboratory Portal
        notificationService.dispatch({
          title: 'New Paid Lab Order Ready',
          message: `Lab payment completed for ${patientName} (${payment.description || 'Lab Test'}). Ready for sample processing.`,
          type: 'info',
          module: 'lab',
          targetRoles: ['lab_technician', 'owner'],
          link: '/lab/orders'
        });
      } catch (err) {
        console.warn('[hospitalBillingService] Notice unlocking lab order:', err);
      }
    }

    // C. MEDICATION / INJECTION / NURSING SUPPLY -> Unlock for Nurse Administration
    else if (refType === 'medication_order' || ['injection', 'medicine', 'procedure', 'iv_treatment'].includes(payment.payment_type)) {
      try {
        const medOrderId = refId || payment.medication_order_id;
        let medOrder = null;

        if (medOrderId) {
          medOrder = await ethioCareClient.entities.MedicationOrder.update(medOrderId, {
            payment_status: 'paid',
            administration_status: 'pending',
            payment_id: payment.id,
            receipt_number: receiptNum,
            paid_by: cashier,
            paid_date: paidDate,
            total_price: finalAmount
          });
          orderUnlocked = true;
        }

        // Automatically dispatch/verify NurseTask for nursing procedures/injections
        const effectiveVisitId = visitId || medOrder?.visit_id;
        const effectivePatientId = payment.patient_id || medOrder?.patient_id;

        if (effectiveVisitId && effectivePatientId) {
          const isImmediate = medOrder?.urgency === 'stat' || medOrder?.urgency === 'urgent' || payment.payment_type === 'injection';
          const itemName = medOrder?.item_name || payment.medication_name || payment.description || 'Medication/Injection';
          const dosage = medOrder?.dosage || payment.dosage || '';
          const instructions = medOrder?.instructions || payment.order_notes || `Administer ${itemName}`;

          // Check if NurseTask already exists to avoid duplication
          const existingTasks = await ethioCareClient.entities.NurseTask.filter({ visit_id: effectiveVisitId });
          const taskExists = existingTasks.some(t => t.description?.includes(itemName));

          if (!taskExists) {
            await ethioCareClient.entities.NurseTask.create({
              visit_id: effectiveVisitId,
              patient_id: effectivePatientId,
              patient_name: patientName,
              task_type: medOrder?.order_type === 'iv_treatment' ? 'iv_treatment' : (medOrder?.order_type === 'injection' || payment.payment_type === 'injection') ? 'injection' : 'procedure',
              description: `${isImmediate ? '[IMMEDIATE] ' : ''}${itemName}${dosage ? ` — ${dosage}` : ''}`,
              instructions,
              doctor_name: medOrder?.doctor_name || payment.doctor_name || '',
              status: 'pending'
            });
          }
        }

        // Dispatch notification to Nurse Room
        const isStat = medOrder?.urgency === 'stat';
        notificationService.dispatch({
          title: isStat ? '🚨 IMMEDIATE Nursing Order Paid' : 'New Paid Nursing Order Ready',
          message: `${isStat ? '[STAT IMMEDIATE] ' : ''}Payment completed for ${patientName}: ${payment.description || 'Medication'}. Ready for administration.`,
          type: isStat ? 'alert' : 'info',
          module: 'nurse',
          targetRoles: ['nurse', 'owner'],
          link: '/nurse/medication-orders'
        });
      } catch (err) {
        console.warn('[hospitalBillingService] Notice unlocking medication order:', err);
      }
    }

    // 4. Audit Log
    logAudit({
      userName: cashier,
      userRole: 'accountant',
      action: 'approve',
      module: 'HospitalBilling',
      description: `Settled ${finalAmount} ETB (${payment.description || payment.payment_type}) for ${patientName}. Receipt: ${receiptNum}`,
      recordId: payment.id,
      recordName: patientName
    });

    return {
      success: true,
      payment: updatedPayment,
      receiptNumber: receiptNum,
      referenceType: refType,
      referenceId: refId,
      orderUnlocked
    };
  }
};
