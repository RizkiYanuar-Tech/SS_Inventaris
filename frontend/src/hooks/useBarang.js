import {useState, useEffect, useCallback} from 'react'
import { fetchBarang } from '../api/client'

export function useBarang(){
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    
    const load = useCallback(async () => {
        setLoading(true)
        try{
            const result = await fetchBarang()
            setData(result)
            setError(null)
        } catch (err){
            setError(err.message)
        } finally{
            setLoading(false)
        }
    }, [])

    useEffect(() =>{
        load()
    }, [load])
    
    return { data, loading, error, refresh: load }
}
