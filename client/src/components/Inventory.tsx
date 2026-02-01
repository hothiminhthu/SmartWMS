import React, { useState, useRef, useEffect } from 'react';
import { Product, Category, Brand } from '../types';
import { Search, Plus, Filter, AlertCircle, Edit2, Trash2, MapPin, X, Package, Hash, DollarSign, Calendar, Layers, Tag, Download, ChevronLeft, ChevronRight, Printer, Container, Smartphone, List, Search as SearchIcon, Cpu, HardDrive, Palette } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { ProductLabel } from './ProductLabel';
import { useAuth } from '../hooks/useAuth';
import { warehouseApi } from '../services/api';
import Traceability from './Traceability';

interface InventoryProps {
  products: Product[];
  onAddProduct: (p: Product) => void;
  onUpdateProduct: (p: Product) => void;
  onDeleteProduct: (id: string) => void;
  onNavigateToOptimization?: () => void;
}

const ITEMS_PER_PAGE = 50;

const Inventory: React.FC<InventoryProps> = ({ products, onAddProduct, onUpdateProduct, onDeleteProduct, onNavigateToOptimization }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'list' | 'trace'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [brands, setBrands] = useState<Brand[]>([]);
  
  // State quản lý chuỗi nhập IMEI trong form
  const [imeiInput, setImeiInput] = useState(''); 
  
  // Form State
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    category: Category.LAPTOP,
    minStock: 10,
    quantity: 0,
    price: 0,
    brand: '',
    cpu: '',
    ram: '',
    storage: '',
    color: ''
  });

  const qrRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useAuth();

  // Load brands
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const data = await warehouseApi.getBrands();
        setBrands(data);
      } catch (error) { console.error(error); }
    };
    fetchBrands();
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: printRef, 
    documentTitle: `Tem_${selectedProduct?.sku}`,
  });

  // Filter Logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTableData = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); 
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterCategory(e.target.value);
    setCurrentPage(1); 
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const resetForm = () => {
    setNewProduct({
      category: Category.LAPTOP,
      minStock: 10,
      quantity: 0,
      price: 0,
      name: '', sku: '', location: '', brand: '',
      cpu: '', ram: '', storage: '', color: ''
    });
    setImeiInput('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setNewProduct({ ...product });
    setImeiInput(product.imeis ? product.imeis.join('\n') : '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processedImeis = imeiInput ? imeiInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s !== '') : [];
    
    // Nếu có nhập IMEI thì lấy số lượng theo IMEI, nếu không thì lấy số lượng nhập tay
    const finalQuantity = processedImeis.length > 0 ? processedImeis.length : Number(newProduct.quantity);

    if (newProduct.name && newProduct.sku) {
      const productData: any = {
        ...newProduct,
        quantity: finalQuantity,
        imeis: processedImeis,
        lastUpdated: new Date().toISOString(),
        location: newProduct.location || 'Kho A'
      };

      if (newProduct.id) {
        onUpdateProduct(productData);
      } else {
        onAddProduct(productData);
      }
      setIsModalOpen(false);
      resetForm();
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${name}" không?`)) {
      onDeleteProduct(id);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Tên Sản Phẩm', 'SKU', 'Danh Mục', 'Thương Hiệu', 'Vị Trí', 'Số Lượng','Mã IMEI', 'Giá (VNĐ)', 'Tồn Kho Tối Thiểu', 'Cập Nhật Lần Cuối'];
    const csvContent = [
      headers.join(','),
      ...filteredProducts.map(p => {
        return [
          `"${p.id}"`, `"${p.name.replace(/"/g, '""')}"`, `"${p.sku}"`, `"${p.category}"`, `"${p.brand || ''}"`, `"${p.location}"`,
          p.quantity, `"${(p.imeis || []).join(';')}"`, p.price, p.minStock, `"${p.lastUpdated}"`
        ].join(',');
      })
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper hiển thị tags cấu hình gọn trong bảng
  const renderSpecsSummary = (p: Product) => {
    const specs = [];
    if (p.cpu) specs.push(p.cpu);
    if (p.ram) specs.push(p.ram);
    if (p.storage) specs.push(p.storage);
    if (p.color) specs.push(p.color);
    if (specs.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {specs.map((s, i) => (
          <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
            {s}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Kho Hàng</h2>
          <p className="text-slate-500">Danh sách sản phẩm và trạng thái tồn kho.</p>
        </div>
        
        {/* Nút chuyển chế độ xem */}
        <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
              <List size={18} /> Danh Sách
            </button>
            <button onClick={() => setViewMode('trace')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'trace' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
              <SearchIcon size={18} /> Tra Cứu IMEI
            </button>
        </div>
      </div>

      {viewMode === 'trace' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1">
           <Traceability />
        </div>
      ) : (
        <>
          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            {onNavigateToOptimization && (
              <button onClick={onNavigateToOptimization} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all shadow-sm hidden sm:flex">
                <Container size={18} /> Tối Ưu Vị Trí
              </button>
            )}
            <button onClick={handleExportCSV} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm">
              <Download size={18} /> Xuất CSV
            </button>
            <button onClick={handleOpenAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5">
              <Plus size={18} /> Thêm Mới
            </button>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input type="text" placeholder="Tìm kiếm theo tên hoặc mã SKU..." value={searchTerm} onChange={handleSearchChange} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
            </div>
            <div className="flex items-center gap-2 min-w-[200px]">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Filter size={18} className="text-slate-400" /></div>
                <select value={filterCategory} onChange={handleCategoryChange} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none cursor-pointer">
                  <option value="all">Tất cả danh mục</option>
                  {Object.values(Category).map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sản Phẩm</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Danh Mục</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vị Trí</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tồn Kho</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Giá Trị</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng Thái</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTableData.map((product) => {
                    const isLowStock = product.quantity <= product.minStock;
                    return (
                      <tr key={product.id} onClick={() => setSelectedProduct(product)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{product.name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</div>
                          {renderSpecsSummary(product)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700">{product.category}</div>
                          <div className="text-xs text-slate-400 font-medium">{product.brand}</div>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm">{product.location}</span></td>
                        <td className="px-6 py-4 text-right font-bold text-slate-700">{product.quantity}</td>
                        <td className="px-6 py-4 text-right text-emerald-600 font-medium">{product.price.toLocaleString()} đ</td>
                        <td className="px-6 py-4 text-center">
                          {isLowStock ? <div className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100"><AlertCircle size={12} /> Sắp hết</div> : <div className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Ổn định</div>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleEditClick(product); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 size={16}/></button>
                            {isAdmin && <button onClick={(e) => { e.stopPropagation(); onDeleteProduct(product.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {filteredProducts.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="text-sm text-slate-500">Hiển thị {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredProducts.length)} trên {filteredProducts.length}</div>
                <div className="flex gap-2">
                   <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 border rounded bg-white hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                   <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 border rounded bg-white hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- ADD/EDIT MODAL (FORM CẤU HÌNH CHI TIẾT) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-bold text-xl text-slate-800">{newProduct.id ? 'Cập Nhật Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Thông tin chung */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Tên Sản Phẩm</label>
                        <input required className="w-full border p-2.5 rounded-lg" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Mã SKU</label>
                        <input required className="w-full border p-2.5 rounded-lg" value={newProduct.sku || ''} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Danh Mục</label>
                        <select className="w-full border p-2.5 rounded-lg bg-white" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})}>
                             {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Thương Hiệu</label>
                        <select className="w-full border p-2.5 rounded-lg bg-white" value={newProduct.brand} onChange={e => setNewProduct({...newProduct, brand: e.target.value})}>
                            <option value="">-- Chọn --</option>
                            {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Giá Bán</label>
                        <input type="number" className="w-full border p-2.5 rounded-lg" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                    </div>
                </div>

                {/* --- KHUNG CẤU HÌNH CHI TIẾT --- */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cấu Hình Chi Tiết</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Chỉ hiện CPU/RAM nếu là Laptop hoặc Linh kiện */}
                        {(newProduct.category === Category.LAPTOP || newProduct.category === Category.LAPTOP) && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Cpu size={14}/> CPU</label>
                                    <input placeholder="VD: Core i5, M3" className="w-full border p-2 rounded-lg text-sm" value={newProduct.cpu || ''} onChange={e => setNewProduct({...newProduct, cpu: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">RAM</label>
                                    <input placeholder="VD: 16GB" className="w-full border p-2 rounded-lg text-sm" value={newProduct.ram || ''} onChange={e => setNewProduct({...newProduct, ram: e.target.value})} />
                                </div>
                            </>
                        )}
                        
                        {/* Luôn hiện Dung lượng & Màu */}
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><HardDrive size={14}/> Dung lượng</label>
                             <input placeholder="VD: 512GB, 1TB" className="w-full border p-2 rounded-lg text-sm" value={newProduct.storage || ''} onChange={e => setNewProduct({...newProduct, storage: e.target.value})} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Palette size={14}/> Màu Sắc</label>
                             <input placeholder="VD: Titan Tự Nhiên" className="w-full border p-2 rounded-lg text-sm" value={newProduct.color || ''} onChange={e => setNewProduct({...newProduct, color: e.target.value})} />
                        </div>
                    </div>
                </div>

                {/* Kho & IMEI */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                        <label className="block text-sm font-medium mb-1">Tồn Kho (Auto)</label>
                        <input type="number" disabled className="w-full border bg-slate-100 p-2.5 rounded-lg" value={imeiInput ? imeiInput.split(/[\n,]+/).filter(s => s.trim() !== '').length : newProduct.quantity} />
                   </div>
                   <div>
                        <label className="block text-sm font-medium mb-1">Vị Trí</label>
                        <input className="w-full border p-2.5 rounded-lg" value={newProduct.location} onChange={e => setNewProduct({...newProduct, location: e.target.value})} placeholder="VD: Kệ A-1" />
                   </div>
                   <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Danh sách IMEI (Mỗi dòng 1 mã)</label>
                        <textarea className="w-full border p-2.5 rounded-lg font-mono text-sm h-24" value={imeiInput} onChange={e => setImeiInput(e.target.value)} placeholder="Nhập IMEI..." />
                        <p className="text-[10px] text-slate-500 mt-1">* Số lượng sẽ tự động cập nhật theo số dòng IMEI.</p>
                   </div>
                   <div>
                      <label className="block text-sm font-medium mb-1">Min Stock</label>
                      <input type="number" className="w-full border p-2.5 rounded-lg" value={newProduct.minStock} onChange={e => setNewProduct({...newProduct, minStock: Number(e.target.value)})} />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border rounded-xl font-bold">Hủy</button>
                  <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Lưu</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAIL MODAL (THÔNG SỐ KỸ THUẬT) --- */}
      {/* Modal chi tiết sản phẩm   */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="relative bg-slate-900 text-white p-8 shrink-0">
              <button 
                onClick={() => setSelectedProduct(null)} 
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-brand-500 text-xs font-bold uppercase tracking-wider rounded text-white">
                      {selectedProduct.category}
                    </span>
                    {selectedProduct.quantity <= selectedProduct.minStock && (
                      <span className="px-2 py-1 bg-red-500 text-xs font-bold uppercase tracking-wider rounded text-white flex items-center gap-1">
                        <AlertCircle size={10} /> Sắp Hết
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-bold mb-1">{selectedProduct.name}</h2>
                  <p className="text-slate-400 font-mono text-sm flex items-center gap-2">
                    <Hash size={14} /> {selectedProduct.sku}
                  </p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-slate-400 text-sm">Đơn Giá</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {selectedProduct.price.toLocaleString('vi-VN')} ₫
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Inventory Status */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Trạng Thái Kho
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Package size={16} />
                        <span className="text-xs font-medium">Hiện Có</span>
                      </div>
                      <p className="text-xl font-bold text-slate-800">{selectedProduct.quantity}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Layers size={16} />
                        <span className="text-xs font-medium">Tối Thiểu</span>
                      </div>
                      <p className="text-xl font-bold text-slate-800">{selectedProduct.minStock}</p>
                    </div>
                  </div>
                </div>

                {/* Location & Value */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Thông Tin Khác
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-2 text-sm">
                        <MapPin size={16} className="text-slate-400" /> Vị Trí
                      </span>
                      <span className="font-semibold text-slate-800">{selectedProduct.location}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-2 text-sm">
                        <Tag size={16} className="text-slate-400" /> Danh Mục
                      </span>
                      <span className="font-semibold text-slate-800">{selectedProduct.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-2 text-sm">
                        <DollarSign size={16} className="text-slate-400" /> Tổng Giá Trị
                      </span>
                      <span className="font-bold text-emerald-600">
                        {(selectedProduct.quantity * selectedProduct.price).toLocaleString('vi-VN')} ₫
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* THÔNG SỐ KỸ THUẬT */}
              <div className="mb-6">
                   <h4 className="font-bold text-slate-700 mb-3 border-b pb-2 flex items-center gap-2"><Cpu size={18}/> Thông Số Kỹ Thuật</h4>
                   <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
                      {selectedProduct.cpu && <div><span className="text-slate-400 block text-xs uppercase font-bold">CPU</span> <span className="font-medium text-slate-800">{selectedProduct.cpu}</span></div>}
                      {selectedProduct.ram && <div><span className="text-slate-400 block text-xs uppercase font-bold">RAM</span> <span className="font-medium text-slate-800">{selectedProduct.ram}</span></div>}
                      {selectedProduct.storage && <div><span className="text-slate-400 block text-xs uppercase font-bold">Bộ Nhớ</span> <span className="font-medium text-slate-800">{selectedProduct.storage}</span></div>}
                      {selectedProduct.color && <div><span className="text-slate-400 block text-xs uppercase font-bold">Màu Sắc</span> <span className="font-medium text-slate-800">{selectedProduct.color}</span></div>}
                    </div>
              </div>

              {/* IMEI LIST SECTION (MỚI THÊM) */}
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Smartphone size={18} className="text-slate-400" />
                  Danh sách IMEI / Serial Number tồn kho
                </h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                  {selectedProduct.imeis && selectedProduct.imeis.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProduct.imeis.map((imei, idx) => (
                        <div key={idx} className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 font-mono flex items-center justify-between group hover:border-brand-300 transition-colors">
                          <span>{imei}</span>
                          <span className="text-xs text-slate-300 group-hover:text-brand-500">#{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 italic text-sm">
                      Không có dữ liệu IMEI (Sản phẩm không quản lý theo Serial/IMEI hoặc chưa nhập)
                    </div>
                  )}
                </div>
              </div>
              
              {/* QR Code Section */}
              <div className="mt-8">
                 <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">
                    Mã Định Danh (QR)
                 </h4>
                 <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-2 rounded-lg border border-slate-200" ref={qrRef}>
                        <QRCodeCanvas value={selectedProduct.sku} size={80} level={"H"} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Quét để kiểm kê</p>
                        <p className="text-xs text-slate-500 mb-2">Dùng mã này để quét nhanh trong phần Kiểm Kê.</p>
                        <p className="text-xs font-mono bg-slate-200 px-2 py-0.5 rounded inline-block text-slate-600">{selectedProduct.sku}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handlePrint}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200"
                      title="In tem ngay"
                    >
                      <Printer size={20} />
                    </button>
                 </div>
                  {/* Component ẩn dùng để in */}
                <div style={{ display: "none" }}>
                    <ProductLabel ref={printRef} product={selectedProduct} />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Calendar size={14} />
                  <span>Cập nhật lần cuối: {new Date(selectedProduct.lastUpdated).toLocaleString('vi-VN')}</span>
                </div>
                <div className="flex gap-3">
                   <button 
                    onClick={() => {
                       setSelectedProduct(null);
                       handleEditClick(selectedProduct);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                  >
                    Chỉnh Sửa
                  </button>
                  <button 
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;