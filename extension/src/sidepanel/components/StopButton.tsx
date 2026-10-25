interface Props {
  onStop: () => void
  disabled?: boolean
}

export default function StopButton({ onStop, disabled }: Props) {
  return (
    <button
      onClick={onStop}
      disabled={disabled}
      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-sm py-2 rounded-lg transition-colors"
    >
      ■ STOP
    </button>
  )
}
