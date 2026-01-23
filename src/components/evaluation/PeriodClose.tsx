import React from 'react'
import { Card, CardContent } from '../ui/card'
import { formatDateShort } from '@/utils/quarterHelpers'
import { AlertTriangle } from 'lucide-react'

const PeriodClose = ({ quarterNum, qEndDate ,title='Self-Review'}: { quarterNum: number, qEndDate: Date,title: string }) => {
  return (
    <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
      <h3 className="font-semibold text-lg">Q{quarterNum} {title} Period Has Ended</h3>
      <p className="text-muted-foreground text-center mt-2">
        The deadline for Q{quarterNum} {title} was{' '}
        <span className="font-medium">{qEndDate ? formatDateShort(qEndDate) : 'passed'}</span>.
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        Please contact your HR/Admin to request late submission access.
      </p>
    </CardContent>
  </Card>   
  )
}

export default PeriodClose