export function filterBarang(items, search, selectedCategory){
    return items.filter((item) => {
        // filter data
        const isCategoryMatch = selectedCategory === 'Semua' || item.kategori === selectedCategory;
        const isSearchMatch = 
            item.nama.toLowerCase().includes(search.toLowerCase()) ||
            item.id.toString().includes(search)
        return isCategoryMatch && isSearchMatch
    });
}