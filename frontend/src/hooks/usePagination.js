import { useState } from 'react'

export function usePagination(dataArray, itemsPerPage=10){
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(dataArray.length / itemsPerPage);
    // Jepit bila halaman meluber (ganti mode/filter menyusutkan total).
    const hal = Math.min(currentPage, Math.max(1, totalPages));
    const indexLastItem = hal * itemsPerPage;
    const currentItems = dataArray.slice(indexLastItem - itemsPerPage, indexLastItem);

    const nextPage = () => { if (hal < totalPages) setCurrentPage(hal + 1); };
    const prevPage = () => { if (hal > 1) setCurrentPage(hal - 1); };

    return { currentItems, currentPage: hal,  totalPages, nextPage, prevPage};
}