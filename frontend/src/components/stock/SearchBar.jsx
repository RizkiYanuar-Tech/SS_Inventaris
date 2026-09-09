import {Form, InputGroup} from 'react-bootstrap';
import { Search } from 'lucide-react';

export default function SearchBar({ search, onSearchChange }){
    return (
        <div className='mb-4'>
            <InputGroup className='shadow-sm'>
                <InputGroup.Text 
                    className='bg-white border-end-0'>
                    <Search
                        size={16} 
                        color='#ffff'
                        className='text-muted' 
                    />
                </InputGroup.Text>

                <Form.Control
                    type='text'
                    placeholder='Cari Nama Barang atau ID Barang...'
                    className='border-start-0'
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </InputGroup>
        </div>
    );
}