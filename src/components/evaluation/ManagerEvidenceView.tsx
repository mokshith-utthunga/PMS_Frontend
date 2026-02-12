// Manager Evidence View Component (Read-only)
import { File, Download, EyeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ManagerEvidenceViewProps {
  evidence: string | null | undefined;
  goalId: string;
  managerReviewId: string;
}

export function ManagerEvidenceView({
  evidence,
  goalId,
  managerReviewId,
}: ManagerEvidenceViewProps) {
  // Parse evidence - could be JSON array or text
  const parseEvidenceFiles = (evidenceStr: string | null | undefined): string[] => {
    if (!evidenceStr) return [];
    
    try {
      const parsed = JSON.parse(evidenceStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, return empty array (text evidence not shown as files)
    }
    
    return [];
  };

  const files = parseEvidenceFiles(evidence);

  if (files.length === 0) {
    return null;
  }

  const getFileUrl = (filePath: string) => {
    // If it's already a full SharePoint URL, return it as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
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
      <div className="text-sm font-medium text-muted-foreground">
        Manager Evidence / Supporting Documents
      </div>
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(getFileUrl(filePath), '_blank')}
              title="View/Download"
            >
              <EyeIcon className="h-4 w-4 text-blue-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
