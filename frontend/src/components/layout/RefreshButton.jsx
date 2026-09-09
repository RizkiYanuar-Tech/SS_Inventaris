import { RotateCw } from 'lucide-react'

export default function RefreshButton({onClick, loading}){
    return (
        <button
            onClick={onClick}
            className='p-2 rounded-full bg-white shadow-sm activate:scale-95 transition-transform'
            aria-label='Refresh Data'
        >
            <RotateCw size={18} className={loading ? 'animate-spin text-gray-400': 'text-gray-600'} /> 
        </button>
    )
}
