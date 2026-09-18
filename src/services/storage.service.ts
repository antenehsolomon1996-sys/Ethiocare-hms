import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const storageService = {
  /**
   * Upload a file to a Supabase storage bucket.
   */
  async uploadFile(bucket: string, path: string, file: File): Promise<string> {
    if (!isSupabaseConfigured()) {
      // Return a mock object URL for demo/offline operation
      return URL.createObjectURL(file);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${path}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  },

  /**
   * Upload lab diagnostic test results file (PDF, scan, image).
   */
  async uploadLabResult(orderId: string, file: File): Promise<string> {
    return this.uploadFile('lab-results', `lab_order_${orderId}`, file);
  },

  /**
   * Upload medicine catalogue picture.
   */
  async uploadMedicineImage(medicineId: string, file: File): Promise<string> {
    return this.uploadFile('medicine-images', `med_${medicineId}`, file);
  },
};
