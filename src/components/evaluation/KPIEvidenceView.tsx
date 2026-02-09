// KPI Evidence File View Component (Read-only for managers)
import { File, Download,EyeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/services/api';

interface KPIEvidenceViewProps {
  evidence: string | null | undefined;
  goalId: string;
  employeeId: string;
  quarter: number;
}

export function KPIEvidenceView({
  evidence,
  goalId,
  employeeId,
  quarter,
}: KPIEvidenceViewProps) {

  
  // Parse evidence - could be JSON array of file paths or plain text
  const parseEvidenceFiles = (evidence: string | null | undefined): string[] => {
    if (!evidence) {
      console.log('[KPIEvidenceView] No evidence provided');
      return [];
    }
    try {
      const parsed = JSON.parse(evidence);
      if (Array.isArray(parsed)) {
        console.log('[KPIEvidenceView] Parsed evidence files:', parsed);
        return parsed;
      }
    } catch (e) {
      // Not JSON, treat as text (backward compatibility)
      console.log('[KPIEvidenceView] Evidence is not JSON (text evidence):', evidence);
    }
    return [];
  };

  const files = parseEvidenceFiles(evidence);
  const isTextEvidence = evidence && files.length === 0;

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

  // Always show evidence section if evidence exists
  if (!evidence) {
    return null;
  }

  if (isTextEvidence) {
    // Display as text if it's not a JSON array
    return (
      <div>
        <span className="text-muted-foreground">Evidence: </span>
        <p className="mt-1">{evidence}</p>
      </div>
    );
  }

  // If files array is empty but evidence exists (empty JSON array), show message
  if (files.length === 0) {
    return (
      <div>
        <span className="text-muted-foreground">Evidence: </span>
        <p className="mt-1 text-sm text-muted-foreground">No files uploaded</p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-muted-foreground">Evidence: </span>
      <div className="mt-2 space-y-2">
        {files.map((filePath, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 border rounded-md bg-muted/30"
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
