// Manager Evidence File Upload Component
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, File, X, Download, Loader2 } from 'lucide-react';
import { evaluationService } from '@/services';
import { useToast } from '@/hooks/use-toast';

interface ManagerEvidenceUploadProps {
  goalId: string;
  managerReviewId: string;
  empCode: string;
  quarter: number;
  year: number;
  canEdit: boolean;
  existingFiles?: string[];
  onFilesChange?: (files: string[]) => void;
}

export function ManagerEvidenceUpload({
  goalId,
  managerReviewId,
  empCode,
  quarter,
  year,
  canEdit,
  existingFiles = [],
  onFilesChange,
}: ManagerEvidenceUploadProps) {
  const [files, setFiles] = useState<string[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isInitialMount = useRef(true);
  const lastSyncedFiles = useRef<string>(JSON.stringify(existingFiles));
  const justLoadedFromServer = useRef(false);

  // Load existing files from server - useCallback to prevent stale closures
  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      justLoadedFromServer.current = true; // Set flag to prevent prop sync
      const result = await evaluationService.managerEvidence.getFiles(goalId, managerReviewId);
      const serverFiles = result?.files && Array.isArray(result.files) ? result.files : [];
      const serverFilesStr = JSON.stringify(serverFiles);
      
      // Only update state if files actually changed
      setFiles(prevFiles => {
        const prevFilesStr = JSON.stringify(prevFiles);
        
        if (prevFilesStr !== serverFilesStr) {
          // Update last synced ref to prevent prop sync from overwriting server data
          lastSyncedFiles.current = serverFilesStr;
          // Only notify parent if files changed
          onFilesChange?.(serverFiles);
          return serverFiles;
        }
        return prevFiles;
      });
      
      // Clear flag after a short delay to allow prop updates from other sources
      setTimeout(() => {
        justLoadedFromServer.current = false;
      }, 100);
    } catch (error) {
      console.error('[ManagerEvidenceUpload] Error loading files:', error);
      justLoadedFromServer.current = false;
      // On error, keep existing files state
    } finally {
      setLoading(false);
    }
  }, [goalId, managerReviewId, onFilesChange]);

  // Load existing files on mount or when goalId/managerReviewId changes
  useEffect(() => {
    if (goalId && managerReviewId) {
      loadFiles();
      isInitialMount.current = false;
    }
  }, [goalId, managerReviewId, loadFiles]);

  // Sync with existingFiles prop only if it's different from last synced value
  // This prevents unnecessary updates and loops
  useEffect(() => {
    // Skip sync on initial mount (server load handles that)
    if (isInitialMount.current) return;
    
    // Skip sync if we just loaded from server (prevents overwriting server data with prop)
    if (justLoadedFromServer.current) return;
    
    // Only sync if existingFiles is explicitly provided and different from last synced
    if (existingFiles !== undefined) {
      const existingFilesStr = JSON.stringify([...existingFiles].sort());
      const lastSyncedStr = lastSyncedFiles.current;
      
      // Only update if truly different (not just a reference change)
      if (existingFilesStr !== lastSyncedStr) {
        setFiles(prevFiles => {
          // Also check if it's different from current state
          const currentFilesStr = JSON.stringify([...prevFiles].sort());
          if (existingFilesStr !== currentFilesStr) {
            lastSyncedFiles.current = existingFilesStr;
            return existingFiles;
          }
          return prevFiles;
        });
      }
    }
  }, [existingFiles]);

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
      const result = await evaluationService.managerEvidence.upload(
        managerReviewId,
        goalId,
        empCode,
        quarter,
        year,
        fileToUpload
      );

      if (result?.success) {
        // Retry loading files with exponential backoff to handle backend processing delay
        let retries = 3;
        let delay = 500; // Start with 500ms
        
        while (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          await loadFiles();
          
          // Check if the uploaded file is now in the list
          // We can't check by name since we don't know the exact server filename,
          // so we just verify the count increased or wait a bit more
          retries--;
          if (retries > 0) {
            delay *= 1.5; // Exponential backoff: 500ms, 750ms, 1125ms
          }
        }
        
        toast({
          title: 'Upload successful',
          description: result?.message || 'File uploaded successfully',
        });
      } else {
        throw new Error(result?.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
      // Reload files to ensure state is correct even after error
      await loadFiles();
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      // Optimistically update UI
      const optimisticFiles = files.filter(f => f !== filePath);
      setFiles(optimisticFiles);
      
      await evaluationService.managerEvidence.deleteFile(managerReviewId, goalId, filePath);
      
      // Reload from server to confirm deletion and get accurate state
      await loadFiles();
      
      toast({
        title: 'File deleted',
        description: 'File has been removed',
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      // Reload from server to restore correct state if deletion failed
      await loadFiles();
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
    return filePath;
  };

  const getFileName = (filePath: string) => {
    const parts = filePath.split('/');
    const filename = parts[parts.length - 1];
    // Remove timestamp prefix if present (format: timestamp-filename.pdf)
    return filename.replace(/^\d+-/, '');
  };

  return (
    <div className="space-y-2">
      <Label>Manager Evidence / Supporting Documents</Label>
      
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
