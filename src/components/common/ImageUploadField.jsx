import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Optimizes an image file via HTML5 canvas:
 * - Downsamples to maxDimension (default 512px) preserving aspect ratio
 * - Compresses to WebP (or PNG fallback) to produce compact ~20-50KB base64 payloads
 * - Prevents localStorage quota overflows and keeps database sync fast
 */
export async function optimizeImageFile(file, maxDimension = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    // If it's an SVG, preserve vector quality directly via data URL
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(e.target.result);
          return;
        }

        // Use high-quality bicubic smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to PNG
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {}

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image for optimization'));
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageUploadField({
  id = 'branding-logo',
  label = 'Logo Image',
  value = '',
  onChange,
  placeholder = 'https://example.com/logo.png',
  description = 'Supports PNG, JPG, SVG, or WebP. Auto-optimized to fast responsive dimensions.',
  maxDimension = 512,
}) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'url'
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', {
        description: 'Please select a valid image file (PNG, JPG, SVG, WebP).',
      });
      return;
    }

    // Limit raw file to 15MB before resizing
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File too large', {
        description: 'Please select an image under 15MB.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const optimizedDataUrl = await optimizeImageFile(file, maxDimension);
      onChange(optimizedDataUrl);
      toast.success('Logo uploaded & optimized successfully!', {
        description: `Downsampled to max ${maxDimension}px for fast multi-device loading.`,
      });
    } catch (err) {
      console.error('[ImageUploadField] Optimization error:', err);
      toast.error('Failed to process image', {
        description: err.message || 'Please try another image file.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-semibold text-foreground">
          {label}
        </Label>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            File Upload
          </button>
          <span className="text-muted-foreground text-[11px]">|</span>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              mode === 'url'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Image URL
          </button>
        </div>
      </div>

      {/* Main Container: Preview + Input Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3 rounded-xl border border-border/70 bg-card/50">
        {/* Preview Box */}
        <div className="relative shrink-0 w-20 h-20 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden group shadow-xs">
          {value ? (
            <>
              <img
                src={value}
                alt="Branding Preview"
                className="w-full h-full object-contain p-1"
                loading="lazy"
              />
              <button
                type="button"
                onClick={handleClear}
                aria-label="Remove logo"
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity p-1 text-[10px] font-medium"
              >
                <X className="w-4 h-4 mb-0.5" />
                Remove
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <ImageIcon className="w-6 h-6 opacity-40" />
              <span className="text-[9px] mt-1 font-medium">No Logo</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 w-full space-y-2">
          {mode === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                id={id}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleInputChange}
                className="hidden"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border/80 hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-foreground">
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                      <span>Optimizing Image...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-primary" />
                      <span>Click to upload or drag & drop</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  PNG, JPG, WebP, SVG (Auto-compressed to ~30KB)
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={id}
                  type="url"
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="pl-9 h-10 text-xs font-mono"
                />
              </div>
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-10 text-xs text-destructive hover:bg-destructive/10"
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-tight">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
