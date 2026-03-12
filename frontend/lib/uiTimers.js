export function clearManagedTimer(timerRef) {
  if (timerRef?.current) {
    clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

export function setTemporaryState({
  timerRef,
  setState,
  activeValue,
  resetValue,
  duration,
}) {
  setState(activeValue)
  clearManagedTimer(timerRef)

  timerRef.current = setTimeout(() => {
    setState(resetValue)
    timerRef.current = null
  }, duration)
}