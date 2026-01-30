import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, X, CheckCircle2 } from 'lucide-react';
import { delegationService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { cn } from '@/lib/utils';

interface DelegateButtonProps {
  reporteeId: string;
  reporteeName: string;
  currentDelegation?: {
    id: string;
    delegate_name: string;
    delegate_email: string;
    quarter: number;
  } | null;
  onDelegationChange: () => void;
  quarter?: number;
}

export function DelegateButton({
  reporteeId,
  reporteeName,
  currentDelegation,
  onDelegationChange,
  quarter,
}: DelegateButtonProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    full_name: string;
    email: string;
    emp_code: string;
    department: string;
    grade: string;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { activeCycle } = useActiveCycle();

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await delegationService.searchEmployees(searchQuery);
        setSearchResults(result.data || []);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to search employees',
          variant: 'destructive',
        });
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, toast]);

  const handleSelectDelegate = useCallback(async (delegateId: string, delegateName: string) => {
    if (!activeCycle || !quarter) {
      toast({
        title: 'Error',
        description: 'Active cycle or quarter not available',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      await delegationService.create({
        delegate_id: delegateId,
        reportee_id: reporteeId,
        cycle_id: activeCycle.id,
        quarter,
      });

      toast({
        title: 'Success',
        description: `Delegated ${reporteeName} to ${delegateName} for Q${quarter}`,
      });

      setOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      onDelegationChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create delegation',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }, [activeCycle, quarter, reporteeId, reporteeName, toast, onDelegationChange]);

  const handleRevoke = useCallback(async () => {
    if (!currentDelegation) return;

    setRevoking(true);
    try {
      await delegationService.revoke(currentDelegation.id);
      toast({
        title: 'Success',
        description: 'Delegation revoked',
      });
      onDelegationChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke delegation',
        variant: 'destructive',
      });
    } finally {
      setRevoking(false);
    }
  }, [currentDelegation, toast, onDelegationChange]);

  const isDelegated = currentDelegation && currentDelegation.quarter === quarter;

  if (isDelegated) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Delegated to {currentDelegation.delegate_name}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevoke}
          disabled={revoking}
          aria-label="Revoke delegation"
        >
          {revoking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!activeCycle || !quarter}
          aria-label={`Delegate responsibilities for Q${quarter}`}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Delegate (Q{quarter})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-1">Delegate for {reporteeName}</h4>
            <p className="text-xs text-muted-foreground">
              Q{quarter} - {activeCycle?.name}
            </p>
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Search by employee code or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
              autoFocus
              aria-label="Search employees"
            />
            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No employees found
              </div>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {searchResults.map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => handleSelectDelegate(employee.id, employee.full_name)}
                    disabled={creating}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                      creating && 'opacity-50 cursor-not-allowed'
                    )}
                    aria-label={`Select ${employee.full_name} as delegate`}
                  >
                    <div className="font-medium">{employee.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {employee.emp_code} • {employee.email}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
