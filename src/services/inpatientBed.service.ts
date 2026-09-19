import { ethioCareClient } from '@/api/ethioCareClient';
import { logAudit } from '@/lib/auditLogger';
import { notificationService } from '@/services/notification.service';
import { format, parseISO, differenceInCalendarDays, isValid, startOfDay } from 'date-fns';

export interface StayCalculationResult {
  admissionDate: string;
  dischargeDate: string;
  daysStayed: number;
  billableDays: number;
  dailyRate: number;
  grossCharge: number;
  alreadyPaid: number;
  remainingBalance: number;
  isFullyPaid: boolean;
}

export interface BedAssignmentPayload {
  patient_id: string;
  patient_name: string;
  visit_id?: string | null;
  room_id: string;
  bed_id: string;
  admission_date?: string;
  expected_days?: number;
  daily_rate?: number;
  deposit_amount?: number;
  payment_method?: string;
  payment_status?: 'paid' | 'pending' | 'waived';
  notes?: string;
}

export interface BedDischargePayload {
  bed_id: string;
  assignment_id?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  visit_id?: string | null;
  discharge_date?: string;
  daily_rate?: number;
  gross_charge?: number;
  deposit_paid?: number;
  remaining_balance?: number;
  payment_method?: string;
  is_balance_paid?: boolean;
  is_balance_waived?: boolean;
  waiver_reason?: string;
  notes?: string;
}

export const inpatientBedService = {
  /**
   * Helper to resolve the effective daily rate for a bed (bed rate > room rate > default 500 ETB).
   */
  getEffectiveBedPrice(bed: any, room?: any): number {
    if (bed && typeof bed.price === 'number' && bed.price > 0) {
      return bed.price;
    }
    if (bed && typeof bed.daily_rate === 'number' && bed.daily_rate > 0) {
      return bed.daily_rate;
    }
    if (room && typeof room.daily_rate === 'number' && room.daily_rate > 0) {
      return room.daily_rate;
    }
    return 500;
  },

  /**
   * Calculate stay charges based on admission date and discharge date.
   * Enforces standard inpatient rule: minimum billable duration is 1 day (e.g. same-day discharge is 1 day).
   */
  calculateStaySummary(
    admissionDateInput: string | Date,
    dischargeDateInput: string | Date = new Date(),
    dailyRate: number = 500,
    alreadyPaid: number = 0
  ): StayCalculationResult {
    const admitDate = typeof admissionDateInput === 'string' ? parseISO(admissionDateInput) : admissionDateInput;
    const dischDate = typeof dischargeDateInput === 'string' ? parseISO(dischargeDateInput) : dischargeDateInput;

    const validAdmit = isValid(admitDate) ? admitDate : new Date();
    const validDisch = isValid(dischDate) ? dischDate : new Date();

    const rawDays = differenceInCalendarDays(startOfDay(validDisch), startOfDay(validAdmit));
    const daysStayed = Math.max(0, rawDays);
    const billableDays = Math.max(1, rawDays); // Same-day stay is at least 1 day

    const grossCharge = billableDays * (Number(dailyRate) || 500);
    const paid = Number(alreadyPaid) || 0;
    const remainingBalance = Math.max(0, grossCharge - paid);
    const isFullyPaid = remainingBalance <= 0;

    return {
      admissionDate: validAdmit.toISOString(),
      dischargeDate: validDisch.toISOString(),
      daysStayed,
      billableDays,
      dailyRate: Number(dailyRate) || 500,
      grossCharge,
      alreadyPaid: paid,
      remainingBalance,
      isFullyPaid
    };
  },

  /**
   * Assign an available bed to an inpatient and generate the admission billing / deposit record.
   * Strictly prevents double-booking.
   */
  async assignBed(payload: BedAssignmentPayload, staffIdentifier: string = 'Reception Staff'): Promise<any> {
    if (!payload.bed_id || !payload.room_id || !payload.patient_name?.trim()) {
      throw new Error('Room, Bed, and Patient Name are required for inpatient admission');
    }

    // 1. Verify Bed is not currently occupied
    const targetBed = await ethioCareClient.entities.Bed.get(payload.bed_id);
    if (!targetBed) {
      throw new Error('Selected bed does not exist in the hospital registry');
    }
    if (targetBed.status === 'occupied') {
      throw new Error(`Bed ${targetBed.bed_label || targetBed.bed_number} is already occupied by ${targetBed.current_patient_name || 'another patient'}. Please select another bed.`);
    }

    const targetRoom = await ethioCareClient.entities.Room.get(payload.room_id);
    const nowIso = payload.admission_date || new Date().toISOString();
    const effectiveDailyRate = payload.daily_rate || this.getEffectiveBedPrice(targetBed, targetRoom);
    const expectedDays = Math.max(1, payload.expected_days || 1);
    const totalEstimated = expectedDays * effectiveDailyRate;
    const depositAmt = payload.deposit_amount !== undefined ? Number(payload.deposit_amount) : totalEstimated;
    const paymentStatus = payload.payment_status || (depositAmt > 0 ? 'paid' : 'pending');
    const paymentMethod = payload.payment_method || 'cash';
    const receiptNum = `RCP-BED-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 2. Update Bed Entity to Occupied
    await ethioCareClient.entities.Bed.update(targetBed.id, {
      status: 'occupied',
      current_patient_id: payload.patient_id,
      current_patient_name: payload.patient_name.trim(),
      current_visit_id: payload.visit_id || null,
      assigned_at: nowIso,
      price: effectiveDailyRate
    });

    // 3. Update Visit if present
    if (payload.visit_id) {
      try {
        await ethioCareClient.entities.Visit.update(payload.visit_id, {
          bed_assigned: true,
          bed_status: 'assigned',
          room_number: targetRoom?.room_number || '',
          bed_number: targetBed.bed_number || '',
          assigned_bed_id: targetBed.id
        });
      } catch (visErr) {
        console.warn('[inpatientBedService] Notice updating visit record:', visErr);
      }
    }

    // 4. Create BedAssignment Record
    const assignmentRecord = await ethioCareClient.entities.BedAssignment.create({
      bed_id: targetBed.id,
      room_id: targetRoom?.id || payload.room_id,
      patient_id: payload.patient_id,
      patient_name: payload.patient_name.trim(),
      visit_id: payload.visit_id || null,
      admitted_by: staffIdentifier,
      admission_date: nowIso,
      daily_rate: effectiveDailyRate,
      expected_days: expectedDays,
      total_amount: totalEstimated,
      paid_amount: paymentStatus === 'paid' ? depositAmt : 0,
      status: 'admitted',
      payment_status: paymentStatus,
      notes: payload.notes?.trim() || null
    });

    // 5. Create Payment Record for Admission Deposit
    let createdPayment = null;
    if (depositAmt > 0 || paymentStatus === 'pending') {
      createdPayment = await ethioCareClient.entities.Payment.create({
        visit_id: payload.visit_id || null,
        patient_id: payload.patient_id,
        patient_name: payload.patient_name.trim(),
        payment_type: 'bed',
        description: `Inpatient Admission Deposit — Room ${targetRoom?.room_number || ''}, Bed ${targetBed.bed_number}`,
        amount: depositAmt,
        status: paymentStatus === 'paid' ? 'paid' : paymentStatus === 'waived' ? 'waived' : 'pending',
        payment_method: paymentMethod,
        receipt_number: paymentStatus === 'paid' ? receiptNum : null,
        cashier_name: staffIdentifier,
        paid_date: paymentStatus === 'paid' ? format(new Date(), 'yyyy-MM-dd') : null,
        reference_type: 'bed_admission',
        reference_id: assignmentRecord.id
      });
    }

    // 6. Log Audit
    logAudit({
      userName: staffIdentifier,
      userRole: 'staff',
      action: 'create',
      module: 'InpatientBed',
      description: `Admitted ${payload.patient_name} to Room ${targetRoom?.room_number || ''}, Bed ${targetBed.bed_number} (Daily Rate: ${effectiveDailyRate} ETB, Deposit: ${depositAmt} ETB)`,
      recordId: targetBed.id,
      recordName: `${targetRoom?.room_number || ''} - ${targetBed.bed_number}`
    });

    // 7. Dispatch Notifications
    notificationService.dispatch({
      title: 'Patient Admitted to Bed',
      message: `${payload.patient_name} admitted to Room ${targetRoom?.room_number || ''} → Bed ${targetBed.bed_number}. Inpatient orders and vital tracking active.`,
      type: 'success',
      module: 'patient',
      targetRoles: ['doctor', 'nurse', 'receptionist', 'owner'],
      link: '/reception/beds'
    });

    return {
      bed: targetBed,
      assignment: assignmentRecord,
      payment: createdPayment,
      receiptNumber: paymentStatus === 'paid' ? receiptNum : null
    };
  },

  /**
   * Discharge patient from bed, reconcile stay charges against deposits, record final payment/waiver,
   * and release the bed back to Available.
   */
  async dischargePatient(payload: BedDischargePayload, staffIdentifier: string = 'Reception Staff'): Promise<any> {
    if (!payload.bed_id) {
      throw new Error('Bed ID is required for discharge');
    }

    const bed = await ethioCareClient.entities.Bed.get(payload.bed_id);
    if (!bed) {
      throw new Error('Bed record not found');
    }

    const nowIso = payload.discharge_date || new Date().toISOString();
    const patientName = payload.patient_name || bed.current_patient_name || 'Inpatient';
    const patientId = payload.patient_id || bed.current_patient_id;
    const visitId = payload.visit_id || bed.current_visit_id;

    // 1. Look up active BedAssignment record
    let activeAssignment = null;
    if (payload.assignment_id) {
      activeAssignment = await ethioCareClient.entities.BedAssignment.get(payload.assignment_id);
    } else {
      const assignments = await ethioCareClient.entities.BedAssignment.filter({
        bed_id: bed.id,
        status: 'admitted'
      });
      if (assignments.length > 0) {
        activeAssignment = assignments[0];
      }
    }

    const dailyRate = payload.daily_rate || activeAssignment?.daily_rate || bed.price || 500;
    const admissionDate = activeAssignment?.admission_date || bed.assigned_at || nowIso;

    // Compute stay charges
    const stayCalc = this.calculateStaySummary(
      admissionDate,
      nowIso,
      dailyRate,
      payload.deposit_paid !== undefined ? payload.deposit_paid : (activeAssignment?.paid_amount || 0)
    );

    const grossCharge = payload.gross_charge !== undefined ? payload.gross_charge : stayCalc.grossCharge;
    const depositPaid = payload.deposit_paid !== undefined ? payload.deposit_paid : stayCalc.alreadyPaid;
    const remainingBalance = payload.remaining_balance !== undefined ? payload.remaining_balance : stayCalc.remainingBalance;

    const isBalancePaid = payload.is_balance_paid || remainingBalance <= 0;
    const isBalanceWaived = payload.is_balance_waived || false;
    const paymentMethod = payload.payment_method || 'cash';
    const receiptNum = `RCP-DISCH-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

    let finalPaymentRecord = null;

    // 2. Record Final Payment if balance exists and is being settled
    if (remainingBalance > 0 && isBalancePaid) {
      finalPaymentRecord = await ethioCareClient.entities.Payment.create({
        visit_id: visitId || null,
        patient_id: patientId || null,
        patient_name: patientName,
        payment_type: 'bed',
        description: `Inpatient Final Settlement — Bed ${bed.bed_label || bed.bed_number} (${stayCalc.billableDays} day${stayCalc.billableDays > 1 ? 's' : ''} stay)`,
        amount: remainingBalance,
        status: 'paid',
        payment_method: paymentMethod,
        receipt_number: receiptNum,
        cashier_name: staffIdentifier,
        paid_date: format(new Date(), 'yyyy-MM-dd'),
        reference_type: 'bed_discharge',
        reference_id: activeAssignment?.id || bed.id
      });
    }

    // 3. Update BedAssignment Record
    if (activeAssignment?.id) {
      const finalPaidAmount = depositPaid + (isBalancePaid ? remainingBalance : 0);
      const finalPaymentStatus = (isBalancePaid || remainingBalance <= 0) ? 'paid' : isBalanceWaived ? 'waived' : 'partially_paid';

      await ethioCareClient.entities.BedAssignment.update(activeAssignment.id, {
        discharge_date: nowIso,
        total_amount: grossCharge,
        paid_amount: finalPaidAmount,
        status: 'discharged',
        payment_status: finalPaymentStatus,
        notes: [
          activeAssignment.notes,
          payload.notes,
          isBalanceWaived ? `Remaining balance of ${remainingBalance} ETB waived (${payload.waiver_reason || 'Authorized waiver'})` : null
        ].filter(Boolean).join('\n')
      });
    }

    // 4. Release Bed back to Available
    await ethioCareClient.entities.Bed.update(bed.id, {
      status: 'available',
      current_patient_id: null,
      current_patient_name: null,
      current_visit_id: null,
      assigned_at: null
    });

    // 5. Update Visit if linked
    if (visitId) {
      try {
        await ethioCareClient.entities.Visit.update(visitId, {
          bed_status: 'discharged'
        });
      } catch (visErr) {
        console.warn('[inpatientBedService] Notice updating visit discharge status:', visErr);
      }
    }

    // 6. Log Audit
    logAudit({
      userName: staffIdentifier,
      userRole: 'staff',
      action: 'update',
      module: 'InpatientBed',
      description: `Discharged ${patientName} from Bed ${bed.bed_label || bed.bed_number} (Stay: ${stayCalc.billableDays} days, Total: ${grossCharge} ETB, Settled: ${remainingBalance > 0 ? (isBalancePaid ? `${remainingBalance} ETB paid` : 'waived') : 'Fully settled'})`,
      recordId: bed.id,
      recordName: bed.bed_label || bed.bed_number
    });

    // 7. Dispatch Notification
    notificationService.dispatch({
      title: 'Inpatient Discharged & Bed Available',
      message: `${patientName} discharged from ${bed.bed_label || `Bed ${bed.bed_number}`}. Bed sanitized and marked available.`,
      type: 'info',
      module: 'patient',
      targetRoles: ['doctor', 'nurse', 'receptionist', 'owner'],
      link: '/reception/beds'
    });

    return {
      success: true,
      bed,
      staySummary: stayCalc,
      finalPayment: finalPaymentRecord,
      receiptNumber: isBalancePaid && remainingBalance > 0 ? receiptNum : null
    };
  }
};
