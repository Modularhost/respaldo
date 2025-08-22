import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCTW1DbRaD0AruIRQ_Tn-e-bB8paTV4NNs",
    authDomain: "locateit-612c0.firebaseapp.com",
    projectId: "locateit-612c0",
    storageBucket: "locateit-612c0.firebasestorage.app",
    messagingSenderId: "1054365620372",
    appId: "1:1054365620372:web:401c55c834cbd9d4bdfc81",
    measurementId: "G-2CXE0EZ940"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (location.hostname === 'localhost') {
    try {
        connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (error) {
        console.log('Emulador no disponible, usando Firebase en producción');
    }
}

window.db = db;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.deleteDoc = deleteDoc;
window.collection = collection;
window.doc = doc;
window.onSnapshot = onSnapshot;

console.log('Firebase inicializado correctamente');

// Variables globales
let currentView = 'mapa';
let currentPage = 1;
let currentCatalogPage = 1;
const itemsPerPage = 10;
let allItems = [];
let filteredItems = [];
let allCatalog = [];
let filteredCatalog = [];
let currentModal = null;
let selectedItems = new Set();
let sortField = 'code';
let sortDirection = 'asc';
let catalogSortField = 'code';
let catalogSortDirection = 'asc';
let warehouseConfig = {
    pasillos: 4,
    estantes: 4,
    casillas: 6
};

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    await loadWarehouseConfig();
    await loadItems();
    await loadCatalog();
    generateWarehouse();
    updateItemsTable();
    updateCatalogTable();
    updateLocationSelectors();
    setupEventListeners();
    showNotification('Sistema iniciado correctamente');
});

// Configuración de listeners
function setupEventListeners() {
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', switchView);
    });

    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('itemsSearchInput').addEventListener('input', handleItemsSearch);
    document.getElementById('catalogSearchInput').addEventListener('input', handleCatalogSearch);
    
    ['pasillosInput', 'estantesInput', 'casillasInput'].forEach(id => {
        document.getElementById(id).addEventListener('change', saveWarehouseConfig);
    });

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', function(event) {
        const searchContainer = document.querySelector('.search-container');
        const suggestions = document.getElementById('searchSuggestions');
        if (searchContainer && suggestions && !searchContainer.contains(event.target)) {
            suggestions.classList.add('hidden');
        }
    });
}

//Gestión de vistas
function switchView(e) {
    const view = e.target.dataset.view;
    currentView = view;

    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    document.querySelectorAll('[id$="-view"]').forEach(viewEl => {
        viewEl.classList.add('hidden');
    });
    document.getElementById(view + '-view').classList.remove('hidden');

    if (view === 'items') {
        updateItemsTable();
    } else if (view === 'catalogo') {
        updateCatalogTable();
    }
}

// Generación del almacén
function generateWarehouse() {
    const grid = document.getElementById('warehouseGrid');
    grid.innerHTML = '';

    for (let p = 1; p <= warehouseConfig.pasillos; p++) {
        const pasilloDiv = document.createElement('div');
        pasilloDiv.className = 'pasillo';
        
        const header = document.createElement('div');
        header.className = 'pasillo-header';
        header.textContent = `Pasillo ${p}`;
        pasilloDiv.appendChild(header);

        const estantesDiv = document.createElement('div');
        estantesDiv.className = 'estantes';

        const estanteLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
        for (let e = 0; e < warehouseConfig.estantes; e++) {
            const estanteDiv = document.createElement('div');
            estanteDiv.className = 'estante';
            
            const label = document.createElement('div');
            label.className = 'estante-label';
            label.textContent = `Estante ${estanteLabels[e]}`;
            estanteDiv.appendChild(label);

            const casillasGrid = document.createElement('div');
            casillasGrid.className = 'casillas-grid';

            for (let c = 1; c <= warehouseConfig.casillas; c++) {
                const casilla = document.createElement('div');
                casilla.className = 'casilla';
                casilla.textContent = `C${c}`;
                const location = `${p}-${estanteLabels[e]}-C${c}`;
                casilla.dataset.location = location;
                casilla.addEventListener('click', () => openCasillModal(location));
                
                const item = allItems.find(item => item.location === location);
                if (item) {
                    casilla.classList.add('occupied');
                    casilla.title = `${item.code} - ${item.description}`;
                }

                casillasGrid.appendChild(casilla);
            }

            estanteDiv.appendChild(casillasGrid);
            estantesDiv.appendChild(estanteDiv);
        }

        pasilloDiv.appendChild(estantesDiv);
        grid.appendChild(pasilloDiv);
    }
}

// Nuevas funciones para selectores de ubicación
function updateLocationSelectors() {
    const pasilloSelect = document.getElementById('pasilloSelect');
    pasilloSelect.innerHTML = '<option value="">Seleccionar pasillo</option>';
    
    for (let p = 1; p <= warehouseConfig.pasillos; p++) {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = `Pasillo ${p}`;
        pasilloSelect.appendChild(option);
    }
}

function updateEstanteSelect() {
    const pasilloSelect = document.getElementById('pasilloSelect');
    const estanteSelect = document.getElementById('estanteSelect');
    const casillaSelect = document.getElementById('casillaSelect');
    
    estanteSelect.innerHTML = '<option value="">Seleccionar estante</option>';
    casillaSelect.innerHTML = '<option value="">Seleccionar casilla</option>';
    casillaSelect.disabled = true;
    
    if (pasilloSelect.value) {
        estanteSelect.disabled = false;
        const estanteLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
        for (let e = 0; e < warehouseConfig.estantes; e++) {
            const option = document.createElement('option');
            option.value = estanteLabels[e];
            option.textContent = `Estante ${estanteLabels[e]}`;
            estanteSelect.appendChild(option);
        }
    } else {
        estanteSelect.disabled = true;
    }
}

function updateCasillaSelect() {
    const pasilloSelect = document.getElementById('pasilloSelect');
    const estanteSelect = document.getElementById('estanteSelect');
    const casillaSelect = document.getElementById('casillaSelect');
    
    casillaSelect.innerHTML = '<option value="">Seleccionar casilla</option>';
    
    if (pasilloSelect.value && estanteSelect.value) {
        casillaSelect.disabled = false;
        
        for (let c = 1; c <= warehouseConfig.casillas; c++) {
            const location = `${pasilloSelect.value}-${estanteSelect.value}-C${c}`;
            if (!allItems.find(item => item.location === location)) {
                const option = document.createElement('option');
                option.value = `C${c}`;
                option.textContent = `Casilla ${c}`;
                casillaSelect.appendChild(option);
            }
        }
        
        if (casillaSelect.children.length === 1) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay casillas disponibles';
            option.disabled = true;
            casillaSelect.appendChild(option);
        }
    } else {
        casillaSelect.disabled = true;
    }
}

// Funciones de ordenamiento
function sortItems(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }

    document.querySelectorAll('[id^="sort-"]').forEach(span => {
        span.textContent = '↕️';
    });
    
    const indicator = document.getElementById(`sort-${field}`);
    if (indicator) {
        indicator.textContent = sortDirection === 'asc' ? '↑' : '↓';
    }

    filteredItems.sort((a, b) => {
        let aVal = a[field] || '';
        let bVal = b[field] || '';
        
        if (field === 'timestamp') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    updateItemsTable();
}

function sortCatalog(field) {
    if (catalogSortField === field) {
        catalogSortDirection = catalogSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        catalogSortField = field;
        catalogSortDirection = 'asc';
    }

    document.querySelectorAll('[id^="sort-catalog-"]').forEach(span => {
        span.textContent = '↕️';
    });
    
    const indicator = document.getElementById(`sort-catalog-${field}`);
    if (indicator) {
        indicator.textContent = catalogSortDirection === 'asc' ? '↑' : '↓';
    }

    filteredCatalog.sort((a, b) => {
        let aVal = a[field] || '';
        let bVal = b[field] || '';
        
        if (aVal < bVal) return catalogSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return catalogSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    updateCatalogTable();
}

// Funciones de selección múltiple
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const itemCheckboxes = document.querySelectorAll('input[name="itemSelect"]');
    
    itemCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        if (selectAllCheckbox.checked) {
            selectedItems.add(checkbox.value);
        } else {
            selectedItems.delete(checkbox.value);
        }
    });
    
    toggleBulkActions();
}

function toggleItemSelection(location, checked) {
    if (checked) {
        selectedItems.add(location);
    } else {
        selectedItems.delete(location);
    }
    
    const totalItems = document.querySelectorAll('input[name="itemSelect"]').length;
    const selectedCount = selectedItems.size;
    const selectAllCheckbox = document.getElementById('selectAll');
    
    selectAllCheckbox.checked = selectedCount === totalItems && totalItems > 0;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalItems;
    
    toggleBulkActions();
}

function toggleBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    bulkActions.style.display = selectedItems.size > 0 ? 'block' : 'none';
}

// Acciones masivas
async function bulkDelete() {
    if (selectedItems.size === 0) return;
    
    if (confirm(`¿Estás seguro de eliminar ${selectedItems.size} items?`)) {
        const deletePromises = Array.from(selectedItems).map(location => 
            deleteDoc(doc(db, 'items', location))
        );
        
        try {
            await Promise.all(deletePromises);
            selectedItems.clear();
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            showNotification(`${deletePromises.length} items eliminados`);
        } catch (error) {
            console.error('Error en eliminación masiva:', error);
            alert('Error al eliminar algunos items');
        }
    }
}

function bulkExport() {
    if (selectedItems.size === 0) return;
    
    const selectedItemsData = allItems.filter(item => selectedItems.has(item.location));
    const data = {
        items: selectedItemsData,
        exportDate: new Date().toISOString(),
        count: selectedItemsData.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items_seleccionados_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification(`${selectedItemsData.length} items exportados`);
}

// Modal para casillas
function openCasillModal(location) {
    currentModal = location;
    const modal = document.getElementById('casillModal');
    const title = document.getElementById('modalTitle');
    title.textContent = `Gestionar Casilla ${location}`;

    const existingItem = allItems.find(item => item.location === location);
    if (existingItem) {
        document.getElementById('modalItemCode').value = existingItem.code || '';
        document.getElementById('modalItemDescription').value = existingItem.description || '';
    } else {
        document.getElementById('modalItemCode').value = '';
        document.getElementById('modalItemDescription').value = '';
    }

    modal.style.display = 'block';
}

function closeCasillModal() {
    document.getElementById('casillModal').style.display = 'none';
    currentModal = null;
}

async function saveItemToModal() {
    if (!currentModal) return;

    const code = document.getElementById('modalItemCode').value.trim().toUpperCase();
    const description = document.getElementById('modalItemDescription').value.trim();

    if (!code) {
        alert('El código del item es requerido');
        return;
    }

    const catalogItem = allCatalog.find(item => item.code === code);
    if (!catalogItem) {
        alert('Este código no existe en el catálogo. Agrégalo primero al catálogo.');
        return;
    }

    const itemData = {
        code: code,
        description: catalogItem.description,
        location: currentModal,
        timestamp: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, 'items', currentModal), itemData);
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        updateLocationSelectors();
        closeCasillModal();
        showNotification('Item guardado correctamente');
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar el item');
    }
}

async function removeItemFromModal() {
    if (!currentModal) return;

    try {
        await deleteDoc(doc(db, 'items', currentModal));
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        updateLocationSelectors();
        closeCasillModal();
        showNotification('Item eliminado correctamente');
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar el item');
    }
}

// Nuevo modal para información del item
function openItemModal(item) {
    document.getElementById('itemCodeView').textContent = item.code;
    document.getElementById('itemDescriptionView').textContent = item.description;
    const [pasillo, estante, casilla] = item.location.split('-');
    document.getElementById('itemLocationView').textContent = `Pasillo ${pasillo}, Estante ${estante}, Casilla ${casilla.replace('C', '')}`;
    document.getElementById('itemModal').style.display = 'block';
}

function closeItemModal() {
    document.getElementById('itemModal').style.display = 'none';
}

// Gestión de items
async function loadItems() {
    try {
        const querySnapshot = await getDocs(collection(db, 'items'));
        allItems = [];
        querySnapshot.forEach((doc) => {
            allItems.push({ id: doc.id, ...doc.data() });
        });
        filteredItems = [...allItems];
        document.getElementById('itemsCount').textContent = allItems.length;
    } catch (error) {
        console.error('Error al cargar items:', error);
    }
}

async function addItem() {
    const code = document.getElementById('itemCode').value.trim().toUpperCase();
    const description = document.getElementById('itemDescription').value.trim();
    
    const pasillo = document.getElementById('pasilloSelect').value;
    const estante = document.getElementById('estanteSelect').value;
    const casilla = document.getElementById('casillaSelect').value;

    if (!code) {
        alert('El código del item es requerido');
        return;
    }

    if (!pasillo || !estante || !casilla) {
        alert('Selecciona una ubicación completa (pasillo, estante y casilla)');
        return;
    }

    const catalogItem = allCatalog.find(item => item.code === code);
    if (!catalogItem) {
        alert('Este código no existe en el catálogo. Agrégalo primero al catálogo.');
        return;
    }

    const location = `${pasillo}-${estante}-${casilla}`;

    if (allItems.find(item => item.location === location)) {
        alert('Esta ubicación ya está ocupada');
        return;
    }

    const itemData = {
        code: code,
        description: catalogItem.description,
        location: location,
        timestamp: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, 'items', location), itemData);
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        updateCatalogTable();
        updateLocationSelectors();
        
        document.getElementById('itemCode').value = '';
        document.getElementById('itemDescription').value = '';
        document.getElementById('pasilloSelect').value = '';
        document.getElementById('estanteSelect').value = '';
        document.getElementById('casillaSelect').value = '';
        document.getElementById('estanteSelect').disabled = true;
        document.getElementById('casillaSelect').disabled = true;
        
        showNotification('Item ubicado correctamente');
    } catch (error) {
        console.error('Error al ubicar item:', error);
        alert('Error al ubicar el item');
    }
}

async function removeItem(location) {
    if (confirm('¿Estás seguro de que quieres eliminar este item?')) {
        try {
            await deleteDoc(doc(db, 'items', location));
            selectedItems.delete(location);
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            showNotification('Item eliminado correctamente');
        } catch (error) {
            console.error('Error al eliminar item:', error);
            alert('Error al eliminar el item');
        }
    }
}

async function clearAllItems() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los items? Esta acción no se puede deshacer.')) {
        try {
            const querySnapshot = await getDocs(collection(db, 'items'));
            const deletePromises = [];
            querySnapshot.forEach((docSnapshot) => {
                deletePromises.push(deleteDoc(doc(db, 'items', docSnapshot.id)));
            });
            await Promise.all(deletePromises);
            selectedItems.clear();
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            showNotification('Todos los items eliminados');
        } catch (error) {
            console.error('Error al eliminar todos los items:', error);
            alert('Error al eliminar los items');
        }
    }
}

// Tabla de items
function updateItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredItems.slice(startIndex, endIndex);

    pageItems.forEach(item => {
        const row = document.createElement('tr');
        const isSelected = selectedItems.has(item.location);
        
        const date = new Date(item.timestamp || Date.now());
        const formattedDate = date.toLocaleDateString('es-ES');
        
        row.innerHTML = `
            <td>
                <input type="checkbox" name="itemSelect" value="${item.location}" 
                       ${isSelected ? 'checked' : ''} 
                       onchange="toggleItemSelection('${item.location}', this.checked)">
            </td>
            <td><strong style="font-family: monospace; background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 4px;">${item.code}</strong></td>
            <td>${item.description || ''}</td>
            <td>
                <code style="background: #e9ecef; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9rem;">${item.location}</code>
            </td>
            <td style="font-size: 0.8rem; color: #666;">${formattedDate}</td>
            <td>
                <button class="btn btn-secondary" onclick="editItemInline('${item.location}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.25rem;">✏️</button>
                <button class="btn btn-secondary" onclick="removeItem('${item.location}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #dc3545; color: white;">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    
    const totalItems = pageItems.length;
    const selectedCount = pageItems.filter(item => selectedItems.has(item.location)).length;
    const selectAllCheckbox = document.getElementById('selectAll');
    
    if (totalItems === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = selectedCount === totalItems;
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalItems;
    }
}

function editItemInline(location) {
    const item = allItems.find(i => i.location === location);
    if (item) {
        openCasillModal(location);
    }
}

// Búsqueda
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const originalQuery = document.getElementById('searchInput').value; // Para mostrar en sugerencias sin lower
    showSuggestions(originalQuery);
    handleSearchLogic(query);
}

function handleItemsSearch() {
    const query = document.getElementById('itemsSearchInput').value.toLowerCase();
    handleSearchLogic(query);
}

function handleSearchLogic(query) {
    if (!query) {
        filteredItems = [...allItems];
    } else {
        filteredItems = allItems.filter(item => 
            item.code.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            item.location.toLowerCase().includes(query)
        );
    }
    currentPage = 1;
    updateItemsTable();
    highlightSearchResults(query);
}

function highlightSearchResults(query) {
    document.querySelectorAll('.casilla').forEach(casilla => {
        casilla.classList.remove('highlighted');
        if (query) {
            const location = casilla.dataset.location;
            const item = allItems.find(i => i.location === location);
            if (item && (
                item.code.toLowerCase().includes(query.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(query.toLowerCase())) ||
                location.toLowerCase().includes(query.toLowerCase())
            )) {
                casilla.style.background = '#fff3cd';
                casilla.style.borderColor = '#ffc107';
            }
        } else {
            casilla.style.background = '';
            casilla.style.borderColor = '';
        }
    });
}

// Nueva función para mostrar sugerencias
function showSuggestions(query) {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.classList.add('hidden');

    if (!query.trim()) return;

    const filtered = allItems.filter(item => 
        item.code.toLowerCase().includes(query.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
    );

    if (filtered.length === 0) return;

    const ul = document.createElement('ul');

    filtered.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.code} - ${item.description}`;
        li.addEventListener('click', () => {
            openItemModal(item);
            suggestionsDiv.classList.add('hidden');
        });
        ul.appendChild(li);
    });

    suggestionsDiv.appendChild(ul);
    suggestionsDiv.classList.remove('hidden');
}

// Paginación
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        updateItemsTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        updateItemsTable();
    }
}

function previousCatalogPage() {
    if (currentCatalogPage > 1) {
        currentCatalogPage--;
        updateCatalogTable();
    }
}

function nextCatalogPage() {
    const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
    if (currentCatalogPage < totalPages) {
        currentCatalogPage++;
        updateCatalogTable();
    }
}

// Configuración del almacén
async function loadWarehouseConfig() {
    try {
        const configDoc = await getDoc(doc(db, 'config', 'warehouse'));
        if (configDoc.exists()) {
            warehouseConfig = configDoc.data();
            document.getElementById('pasillosInput').value = warehouseConfig.pasillos;
            document.getElementById('estantesInput').value = warehouseConfig.estantes;
            document.getElementById('casillasInput').value = warehouseConfig.casillas;
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

async function saveWarehouseConfig() {
    try {
        await setDoc(doc(db, 'config', 'warehouse'), warehouseConfig);
    } catch (error) {
        console.error('Error al guardar configuración:', error);
    }
}

async function applyChanges() {
    const newConfig = {
        pasillos: parseInt(document.getElementById('pasillosInput').value),
        estantes: parseInt(document.getElementById('estantesInput').value),
        casillas: parseInt(document.getElementById('casillasInput').value)
    };

    if (newConfig.pasillos < 1 || newConfig.pasillos > 10 ||
        newConfig.estantes < 1 || newConfig.estantes > 8 ||
        newConfig.casillas < 1 || newConfig.casillas > 10) {
        alert('Los valores deben estar dentro de los rangos permitidos');
        return;
    }

    warehouseConfig = newConfig;
    
    try {
        await saveWarehouseConfig();
        await loadItems();
        generateWarehouse();
        updateLocationSelectors();
        showNotification('Configuración aplicada correctamente');
    } catch (error) {
        console.error('Error al aplicar cambios:', error);
        alert('Error al aplicar los cambios');
    }
}

function revertChanges() {
    document.getElementById('pasillosInput').value = warehouseConfig.pasillos;
    document.getElementById('estantesInput').value = warehouseConfig.estantes;
    document.getElementById('casillasInput').value = warehouseConfig.casillas;
    showNotification('Cambios revertidos');
}

// Importar/Exportar datos
function exportData() {
    const data = {
        config: warehouseConfig,
        items: allItems,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bodega_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Datos exportados correctamente');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let data;
            
            if (file.name.endsWith('.json')) {
                data = JSON.parse(e.target.result);
                await importFromJSON(data);
            } else if (file.name.endsWith('.csv')) {
                await importFromCSV(e.target.result);
            }
            
            showNotification('Datos importados correctamente');
        } catch (error) {
            console.error('Error al importar:', error);
            alert('Error al importar los datos. Verifica el formato del archivo.');
        }
    };
    
    reader.readAsText(file);
}

async function importFromJSON(data) {
    if (data.config) {
        warehouseConfig = data.config;
        await saveWarehouseConfig();
        document.getElementById('pasillosInput').value = warehouseConfig.pasillos;
        document.getElementById('estantesInput').value = warehouseConfig.estantes;
        document.getElementById('casillasInput').value = warehouseConfig.casillas;
    }

    if (data.items && Array.isArray(data.items)) {
        const importPromises = data.items.map(item => {
            return setDoc(doc(db, 'items', item.location), {
                code: item.code,
                description: item.description || '',
                location: item.location,
                timestamp: item.timestamp || new Date().toISOString()
            });
        });
        
        await Promise.all(importPromises);
    }

    await loadItems();
    generateWarehouse();
    updateItemsTable();
    updateLocationSelectors();
}

async function importFromCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const requiredColumns = ['code', 'location'];
    const hasRequired = requiredColumns.every(col => headers.includes(col));
    
    if (!hasRequired) {
        alert('El CSV debe contener al menos las columnas: code, location');
        return;
    }

    const importPromises = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
        const item = {};
        
        headers.forEach((header, index) => {
            item[header] = values[index] || '';
        });

        if (item.code && item.location) {
            importPromises.push(
                setDoc(doc(db, 'items', item.location), {
                    code: item.code,
                    description: item.description || '',
                    location: item.location,
                    timestamp: new Date().toISOString()
                })
            );
        }
    }

    await Promise.all(importPromises);
    await loadItems();
    generateWarehouse();
    updateItemsTable();
    updateLocationSelectors();
}

// Gestión del catálogo
async function loadCatalog() {
    try {
        const querySnapshot = await getDocs(collection(db, 'catalog'));
        allCatalog = [];
        querySnapshot.forEach((doc) => {
            allCatalog.push({ id: doc.id, ...doc.data() });
        });
        filteredCatalog = [...allCatalog];
        document.getElementById('catalogoCount').textContent = allCatalog.length;
    } catch (error) {
        console.error('Error al cargar catálogo:', error);
    }
}

async function addToCatalog() {
    const code = document.getElementById('catalogCode').value.trim().toUpperCase();
    const description = document.getElementById('catalogDescription').value.trim();

    if (!code || !description) {
        alert('El código y la descripción son requeridos');
        return;
    }

    if (allCatalog.find(item => item.code === code)) {
        alert('Este código ya existe en el catálogo');
        return;
    }

    const catalogData = {
        code: code,
        description: description,
        timestamp: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, 'catalog', code), catalogData);
        await loadCatalog();
        updateCatalogTable();
        document.getElementById('catalogCode').value = '';
        document.getElementById('catalogDescription').value = '';
        showNotification('Producto agregado al catálogo');
    } catch (error) {
        console.error('Error al agregar al catálogo:', error);
        alert('Error al agregar el producto al catálogo');
    }
}

async function removeCatalogItem(code) {
    if (confirm('¿Estás seguro de que quieres eliminar este producto del catálogo?')) {
        try {
            await deleteDoc(doc(db, 'catalog', code));
            await loadCatalog();
            updateCatalogTable();
            showNotification('Producto eliminado del catálogo');
        } catch (error) {
            console.error('Error al eliminar del catálogo:', error);
            alert('Error al eliminar el producto');
        }
    }
}

async function quickLocateItem(code) {
    const catalogItem = allCatalog.find(item => item.code === code);
    if (!catalogItem) return;

    document.getElementById('itemCode').value = code;
    document.getElementById('itemDescription').value = catalogItem.description;
    switchView({ target: { dataset: { view: 'items' } } });
}

function updateCatalogTable() {
    const tbody = document.getElementById('catalogTableBody');
    tbody.innerHTML = '';

    const startIndex = (currentCatalogPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredCatalog.slice(startIndex, endIndex);

    pageItems.forEach(item => {
        const row = document.createElement('tr');
        const inWarehouse = allItems.filter(i => i.code === item.code).length;
        
        row.innerHTML = `
            <td><strong style="font-family: monospace; background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 4px;">${item.code}</strong></td>
            <td>${item.description}</td>
            <td>${inWarehouse} unidad${inWarehouse !== 1 ? 'es' : ''}</td>
            <td>
                <button class="btn btn-secondary" onclick="quickLocateItem('${item.code}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.25rem;">📍</button>
                <button class="btn btn-secondary" onclick="removeCatalogItem('${item.code}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #dc3545; color: white;">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
    document.getElementById('currentCatalogPage').textContent = currentCatalogPage;
    document.getElementById('totalCatalogPages').textContent = totalPages;
    document.getElementById('prevCatalogBtn').disabled = currentCatalogPage <= 1;
    document.getElementById('nextCatalogBtn').disabled = currentCatalogPage >= totalPages;
}

function handleCatalogSearch() {
    const query = document.getElementById('catalogSearchInput').value.toLowerCase();
    if (!query) {
        filteredCatalog = [...allCatalog];
    } else {
        filteredCatalog = allCatalog.filter(item => 
            item.code.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );
    }
    currentCatalogPage = 1;
    updateCatalogTable();
}

function exportCatalog() {
    const data = {
        catalog: allCatalog,
        exportDate: new Date().toISOString(),
        count: allCatalog.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogo_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Catálogo exportado correctamente');
}

async function importCatalogCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const lines = e.target.result.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            const requiredColumns = ['code', 'description'];
            const hasRequired = requiredColumns.every(col => headers.includes(col));
            
            if (!hasRequired) {
                alert('El CSV debe contener al menos las columnas: code, description');
                return;
            }

            const importPromises = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
                const item = {};
                
                headers.forEach((header, index) => {
                    item[header] = values[index] || '';
                });

                if (item.code && item.description) {
                    importPromises.push(
                        setDoc(doc(db, 'catalog', item.code), {
                            code: item.code,
                            description: item.description,
                            timestamp: new Date().toISOString()
                        })
                    );
                }
            }

            await Promise.all(importPromises);
            await loadCatalog();
            updateCatalogTable();
            showNotification('Catálogo importado correctamente');
        } catch (error) {
            console.error('Error al importar catálogo:', error);
            alert('Error al importar el catálogo. Verifica el formato del archivo.');
        }
    };
    
    reader.readAsText(file);
}

async function clearCatalog() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los productos del catálogo? Esta acción no se puede deshacer.')) {
        try {
            const querySnapshot = await getDocs(collection(db, 'catalog'));
            const deletePromises = [];
            querySnapshot.forEach((docSnapshot) => {
                deletePromises.push(deleteDoc(doc(db, 'catalog', docSnapshot.id)));
            });
            await Promise.all(deletePromises);
            await loadCatalog();
            updateCatalogTable();
            showNotification('Catálogo limpiado');
        } catch (error) {
            console.error('Error al limpiar catálogo:', error);
            alert('Error al limpiar el catálogo');
        }
    }
}

// Autocompletado de descripción
function autoFillDescription() {
    const code = document.getElementById('itemCode').value.trim().toUpperCase();
    const descriptionInput = document.getElementById('itemDescription');
    const catalogItem = allCatalog.find(item => item.code === code);
    descriptionInput.value = catalogItem ? catalogItem.description : '';
}

function autoFillModalDescription() {
    const code = document.getElementById('modalItemCode').value.trim().toUpperCase();
    const descriptionInput = document.getElementById('modalItemDescription');
    const catalogItem = allCatalog.find(item => item.code === code);
    descriptionInput.value = catalogItem ? catalogItem.description : '';
}

// Notificaciones
function showNotification(message) {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Cerrar modales al hacer clic fuera
window.addEventListener('click', function(event) {
    const casillModal = document.getElementById('casillModal');
    if (event.target === casillModal) {
        closeCasillModal();
    }
    const itemModal = document.getElementById('itemModal');
    if (event.target === itemModal) {
        closeItemModal();
    }
});

// Atajos de teclado
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeCasillModal();
        closeItemModal();
    }
    
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = currentView === 'items' ? 
            document.getElementById('itemsSearchInput') : 
            document.getElementById('searchInput');
        searchInput.focus();
    }

    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportData();
    }
});

// Funciones globales
window.addItem = addItem;
window.removeItem = removeItem;
window.clearAllItems = clearAllItems;
window.openCasillModal = openCasillModal;
window.closeCasillModal = closeCasillModal;
window.saveItemToModal = saveItemToModal;
window.removeItemFromModal = removeItemFromModal;
window.applyChanges = applyChanges;
window.revertChanges = revertChanges;
window.exportData = exportData;
window.importData = importData;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.updateEstanteSelect = updateEstanteSelect;
window.updateCasillaSelect = updateCasillaSelect;
window.toggleSelectAll = toggleSelectAll;
window.toggleItemSelection = toggleItemSelection;
window.bulkDelete = bulkDelete;
window.bulkExport = bulkExport;
window.sortItems = sortItems;
window.editItemInline = editItemInline;
window.autoFillDescription = autoFillDescription;
window.autoFillModalDescription = autoFillModalDescription;
window.addToCatalog = addToCatalog;
window.removeCatalogItem = removeCatalogItem;
window.quickLocateItem = quickLocateItem;
window.clearCatalog = clearCatalog;
window.exportCatalog = exportCatalog;
window.importCatalogCSV = importCatalogCSV;
window.sortCatalog = sortCatalog;
window.previousCatalogPage = previousCatalogPage;
window.nextCatalogPage = nextCatalogPage;
window.closeItemModal = closeItemModal;
