import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { MetricCardProps } from './MetricCard.types'

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColorClass = 'text-primary bg-primary/10',
  progressValue,
  action,
}: MetricCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${iconColorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-extrabold">{value}</div>
          {action}
        </div>
        {progressValue !== undefined && (
          <Progress value={progressValue} className="h-2 bg-green-100" />
        )}
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
