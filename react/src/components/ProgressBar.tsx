import type { Progress } from '../hooks/useChat'

interface ProgressBarProps {
  progress: Progress
  completed: boolean
}

const ProgressBar = ({ progress, completed }: ProgressBarProps) => {
  const { percent, required_done, required_total } = progress

  return (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {completed ? 'Complete!' : `Step ${required_done} of ${required_total}`}
        </span>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {Math.round(percent)}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            completed ? 'bg-green-500' : 'bg-blue-600'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
