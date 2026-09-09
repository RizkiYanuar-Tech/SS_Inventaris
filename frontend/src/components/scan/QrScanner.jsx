import { useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode'

const READER_ID = 'qr-reader-container'

export default function QrScanner({ onScanSuccess, onError }) {
    const scannerRef = useRef(null)

    useEffect(() =>{
        let isMounted = true

        const scanner = new Html5Qrcode(READER_ID, {
            formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39
            ]
        })
        scannerRef.current = scanner

        const config = {
            fps: 5,
            qrbox: { width: 280, height: 250 },
            videoConstraints: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        }

        scanner
            .start({facingMode: 'environment' }, config, onScanSuccess, () => {})
            .then(() => {
                // Jika komponen sudah di-unmount sebelum start()
                // langsung matikan
                if (!isMounted) {
                    scanner.stop().catch(() => {})
                }
            })
            .catch((err) => onError?.(err))

        // Cleanup: hentikan kamera begitu keluar dari tab scan
        return () => {
            isMounted = false
            // Panggil stop() jika scanner BENERAN lagi jalan / paused
            // Jika masih tengah proses start() biarkan
            const state = scanner.getState()
            if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED){
                scanner.stop().catch(() => {})
            }
        }
    }, [])

    return <div id={READER_ID} className='rounded-3 overflow-hidden mb-3'></div>
}