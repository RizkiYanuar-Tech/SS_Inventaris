import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

export default function TrendChart({ data }){
    return(
        <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0}}>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#FFF' />
                    <XAxis dataKey='hari' tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11}} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12}} />
                    <Bar dataKey='masuk' name='Masuk' fill='#2E6F40' radius={[4, 4, 0, 0]} />
                    <Bar dataKey='keluar' name='Keluar' fill='#7c3aed' radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}