import { useState } from 'react'
import {cekBarang } from '../api/client'

export function useScanner(){
    const [phase, setPhase] = useState('scanning')
    const [pendingCode, setPendingCode] = useState(null)
    const [scannedId, setScannedId] = useState(null)
    const [dataBarang, setDataBarang] = useState(null)
    const [status, setStatus] = useState(null)

    function handleScanSuccess(decodedText){
        const bersih = decodedText.trim()

        if(bersih.length < 4){
            setStatus({ type: 'error', text: 'Hasil Scan tidak valid / terlalu pendek, HARAP SCAN ULANG.'})
            return
        }
    setPendingCode(bersih)
    setStatus(null)
    setPhase('confirming')
    }

    async function handleConfirm(){
        setScannedId(pendingCode)
        setPhase('checking')
        setStatus({ type: 'warning', text: `Memeriksa ID: ${pendingCode} di spreadsheet`})
    
        try {
            const result = await cekBarang(pendingCode)
            setDataBarang(result)
            setStatus(null)
            setPhase(result.ditemukan ? 'found': 'new')
        } catch (error){
            setStatus({type: 'error', text: error.message })
            setPhase('scanning')
        }
    }

    function reset() {
        setPendingCode(null)
        setScannedId(null)
        setDataBarang(null)
        setStatus(null)
        setPhase('scanning')
    }

    function showResult(type, text){
        setStatus({ type, text })
        if (type === 'success'){
            setTimeout(reset, 1500)
        }
    }

    return {
        phase,
        scannedId,
        pendingCode,
        dataBarang,
        status,
        handleScanSuccess,
        handleConfirm,
        reset,
        showResult
    }
}