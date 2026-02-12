// KPI Evidence File Upload Component
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, File, X, Download, Loader2,EyeIcon } from 'lucide-react';
import { evaluationService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/services/api';

interface KPIEvidenceUploadProps {
  goalId: string;
  empCode: string;
  quarter: number;
  year: number;
  employeeId: string;
  canEdit: boolean;
  existingFiles?: string[];
  onFilesChange?: (files: string[]) => void;
}

export function KPIEvidenceUpload({
  goalId,
  empCode,
  quarter,
  year,
  employeeId,
  canEdit,
  existingFiles = [],
  onFilesChange,
}: KPIEvidenceUploadProps) {
  const [files, setFiles] = useState<string[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sync with existingFiles prop
  useEffect(() => {
    console.log('[KPIEvidenceUpload] existingFiles prop changed:', existingFiles);
    if (existingFiles && existingFiles.length > 0) {
      setFiles(existingFiles);
    }
  }, [existingFiles]);

  // Load existing files on mount
  useEffect(() => {
    if (goalId && employeeId && quarter) {
      loadFiles();
    }
  }, [goalId, employeeId, quarter]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const result = await evaluationService.kpiEvidence.getFiles(goalId, employeeId, quarter);
      if (result?.files && Array.isArray(result.files)) {
        console.log('[KPIEvidenceUpload] Setting files from server:', result.files);
        setFiles(result.files);
        onFilesChange?.(result.files);
      } else {
        setFiles([]);
        onFilesChange?.([]);
      }
    } catch (error) {
      console.error('[KPIEvidenceUpload] Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const file = selectedFiles[0];

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Only PDF files are allowed',
        variant: 'destructive',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `${file.name} exceeds 5MB limit`,
        variant: 'destructive',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Upload single file
    await uploadFiles(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFiles = async (fileToUpload: File) => {
    try {
      setUploading(true);
      const result = await evaluationService.kpiEvidence.upload(
        goalId,
        empCode,
        quarter,
        year,
        fileToUpload
      );

      if (result?.success) {
        // Backend returns { success: true, files: [fileUrl], message: string }
        // Get the uploaded file URL from the files array
        const uploadedFiles = result?.files || [];
        
        if (uploadedFiles.length > 0) {
          // Update local state with the new file URLs (should be just one file)
          const newFiles = [...files, ...uploadedFiles];
          setFiles(newFiles);
          // Update parent component via onFilesChange (updates evidence field in kpiRatings state)
          // This updates the evidence field in local state without triggering a refetch
          onFilesChange?.(newFiles);
        }
        
        toast({
          title: 'Upload successful',
          description: result?.message || 'File uploaded successfully',
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await evaluationService.kpiEvidence.deleteFile(goalId, filePath, empCode, quarter, year);
      const newFiles = files.filter(f => f !== filePath);
      setFiles(newFiles);
      onFilesChange?.(newFiles);
      toast({
        title: 'File deleted',
        description: 'File has been removed',
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  const getFileUrl = (filePath: string) => {
    // If it's already a full SharePoint URL, return it as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    // Backward compatibility: if it's a local path, construct URL
    const backendUrl = API_BASE_URL || '';
    const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `${backendUrl}/public${cleanPath}`;
  };

  const getFileName = (filePath: string) => {
    const parts = filePath.split('/');
    const filename = parts[parts.length - 1];
    // Remove timestamp prefix if present (format: timestamp-filename.pdf)
    return filename.replace(/^\d+-/, '');
  };

  return (
    <div className="space-y-2">
      <Label>Evidence / Supporting Data</Label>
      
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload PDF
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            Max 5MB per file, PDF only
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading files...
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          {files.map((filePath, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate" title={getFileName(filePath)}>
                  {getFileName(filePath)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(getFileUrl(filePath), '_blank')}
                  title="View/Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFile(filePath)}
                    title="Delete"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canEdit ? 'No files uploaded yet' : 'No evidence files available'}
        </p>
      )}
    </div>
  );
}
