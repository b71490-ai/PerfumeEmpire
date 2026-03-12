export const TOAST_AUTO_HIDE_MS = 3000

export function showAutoHideToast(setToast, timerRef, type, message, duration = TOAST_AUTO_HIDE_MS) {
	setToast({ type, message })

	if (timerRef?.current) {
		clearTimeout(timerRef.current)
	}

	const timeoutId = setTimeout(() => {
		setToast({ type: '', message: '' })
		if (timerRef) {
			timerRef.current = null
		}
	}, duration)

	if (timerRef) {
		timerRef.current = timeoutId
	}
}

export function clearToastTimer(timerRef) {
	if (timerRef?.current) {
		clearTimeout(timerRef.current)
		timerRef.current = null
	}
}
