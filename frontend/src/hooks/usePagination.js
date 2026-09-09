import { useState } from 'react'

export function usePagination(dataArray, itemsPerPage=10){
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(dataArray.length / itemsPerPage);
    const indexLastItem = currentPage * itemsPerPage;
    const currentItems = dataArray.slice(indexLastItem - itemsPerPage, indexLastItem);

    const nextPage = () => currentPage < totalPages && setCurrentPage(prev => prev + 1);
    const prevPage = () => currentPage > 1 && setCurrentPage(prev => prev - 1);

    return { currentItems, currentPage,  totalPages, nextPage, prevPage};
}