import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Eye, Save, Edit2 } from 'lucide-react';
import ChallanPreview from './ChallanPreview';
import { formatDate } from '../utils/dateFormatter';
import { useToast } from '../context/ToastContext';

export default function ChallanForm() {
    const toast = useToast();
    const [challans, setChallans] = useState([]);
    const [companyConfig, setCompanyConfig] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [goods, setGoods] = useState([]);
    
    // View modes: 'list', 'create', 'preview'
    const [mode, setMode] = useState('list');
    const [selectedChallan, setSelectedChallan] = useState(null);
    const [editingChallanId, setEditingChallanId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Active dropdowns for description comboboxes (tracks row index)
    const [activeComboboxRow, setActiveComboboxRow] = useState(null);
    const comboboxRefs = useRef([]);

    // Challan Form State
    const [challanForm, setChallanForm] = useState({
        challan_no: '',
        date: new Date().toISOString().split('T')[0],
        ref_no: '',
        ref_date: '',
        vehicle_no: '',
        terms_delivery: '',
        customer_id: '',
        customer_name: '',
        customer_address: '',
        customer_state: '',
        customer_state_code: '',
        customer_gstin: '',
        total_quantity: 0,
        items: [
            { sr_no: 1, description: '', hsn_sac: '', quantity: 1 }
        ]
    });

    const fetchData = async () => {
        try {
            const [cfgRes, custRes, goodsRes, challanRes] = await Promise.all([
                fetch('/api/config'),
                fetch('/api/customers'),
                fetch('/api/goods'),
                fetch('/api/challans')
            ]);

            if (cfgRes.ok) setCompanyConfig(await cfgRes.json());
            if (custRes.ok) setCustomers(await custRes.json());
            if (goodsRes.ok) setGoods(await goodsRes.json());
            if (challanRes.ok) setChallans(await challanRes.json());
        } catch (err) {
            console.error('Error fetching baseline data:', err);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
    }, []);

    // Close combobox dropdowns on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (activeComboboxRow !== null) {
                const ref = comboboxRefs.current[activeComboboxRow];
                if (ref && !ref.contains(event.target)) {
                    setActiveComboboxRow(null);
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeComboboxRow]);

    const handleInitCreate = async () => {
        setEditingChallanId(null);
        try {
            const res = await fetch('/api/challans/next-number');
            if (res.ok) {
                const numData = await res.json();
                setChallanForm({
                    challan_no: numData.challan_no,
                    date: new Date().toISOString().split('T')[0],
                    ref_no: '',
                    ref_date: '',
                    vehicle_no: '',
                    terms_delivery: '',
                    customer_id: '',
                    customer_name: '',
                    customer_address: '',
                    customer_state: '',
                    customer_state_code: '',
                    customer_gstin: '',
                    total_quantity: 1,
                    items: [
                        { sr_no: 1, description: '', hsn_sac: '', quantity: 1 }
                    ]
                });
                setMode('create');
            }
        } catch (err) {
            console.error('Sequence loading error:', err);
            toast.error('Could not fetch next sequence number.');
        }
    };

    const handleCustomerChange = (e) => {
        const custId = parseInt(e.target.value) || '';
        if (!custId) {
            setChallanForm(prev => ({
                ...prev,
                customer_id: '',
                customer_name: '',
                customer_address: '',
                customer_state: '',
                customer_state_code: '',
                customer_gstin: ''
            }));
            return;
        }

        const customer = customers.find(c => c.id === custId);
        if (customer) {
            const fullAddress = [customer.address_line1, customer.address_line2, customer.address_line3]
                .filter(Boolean)
                .join('\n');
            
            setChallanForm(prev => ({
                ...prev,
                customer_id: custId,
                customer_name: customer.name,
                customer_address: fullAddress,
                customer_state: customer.state_name || '',
                customer_state_code: customer.state_code || '',
                customer_gstin: customer.gstin || ''
            }));
        }
    };

    const handleItemRowChange = (index, field, value) => {
        setChallanForm(prev => {
            const items = [...prev.items];
            const item = { ...items[index] };
            
            if (field === 'quantity') {
                item.quantity = parseFloat(value) || 0;
            } else {
                item[field] = value;
            }
            
            items[index] = item;
            
            const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
            return {
                ...prev,
                items,
                total_quantity: totalQty
            };
        });
    };

    const handleAddRow = () => {
        setChallanForm(prev => {
            const items = [
                ...prev.items,
                { sr_no: prev.items.length + 1, description: '', hsn_sac: '', quantity: 1 }
            ];
            const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
            return {
                ...prev,
                items,
                total_quantity: totalQty
            };
        });
    };

    const handleRemoveRow = (index) => {
        setChallanForm(prev => {
            if (prev.items.length === 1) return prev;
            
            const filteredItems = prev.items.filter((_, i) => i !== index);
            const items = filteredItems.map((item, idx) => ({
                ...item,
                sr_no: idx + 1
            }));
            
            const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
            return {
                ...prev,
                items,
                total_quantity: totalQty
            };
        });
    };

    const handleSelectGood = (rowIndex, good) => {
        handleItemRowChange(rowIndex, 'description', good.name);
        handleItemRowChange(rowIndex, 'hsn_sac', good.hsn_sac);
        setActiveComboboxRow(null);
    };

    const handleSubmitChallan = async (e) => {
        e.preventDefault();

        if (!challanForm.customer_id) {
            toast.error('Please select a customer.');
            return;
        }

        if (challanForm.items.some(item => !item.description.trim())) {
            toast.error('All line items must have a description.');
            return;
        }

        try {
            const url = editingChallanId ? `/api/challans/${editingChallanId}` : '/api/challans';
            const method = editingChallanId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(challanForm)
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(editingChallanId ? 'Challan updated successfully!' : 'Challan generated successfully!');
                
                const detailsRes = await fetch(`/api/challans/${data.id}`);
                if (detailsRes.ok) {
                    const challanData = await detailsRes.json();
                    setSelectedChallan(challanData);
                    setMode('preview');
                    setEditingChallanId(null);
                    fetchData();
                }
            } else {
                const data = await res.json();
                toast.error(data.detail || 'Failed to submit challan');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error submitting challan');
        }
    };

    const handleEditChallan = async (id) => {
        try {
            const res = await fetch(`/api/challans/${id}`);
            if (res.ok) {
                const data = await res.json();
                setChallanForm({
                    challan_no: data.challan_no,
                    date: data.date,
                    ref_no: data.ref_no || '',
                    ref_date: data.ref_date || '',
                    vehicle_no: data.vehicle_no || '',
                    terms_delivery: data.terms_delivery || '',
                    customer_id: data.customer_id,
                    customer_name: data.customer_name,
                    customer_address: data.customer_address,
                    customer_state: data.customer_state,
                    customer_state_code: data.customer_state_code,
                    customer_gstin: data.customer_gstin || '',
                    total_quantity: data.total_quantity,
                    items: data.items
                });
                setEditingChallanId(id);
                setMode('create');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error fetching challan details for editing');
        }
    };

    const handleViewChallan = async (id) => {
        try {
            const res = await fetch(`/api/challans/${id}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedChallan(data);
                setMode('preview');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error fetching challan details');
        }
    };

    const handleDeleteChallan = async (id) => {
        if (!window.confirm('Are you sure you want to delete this challan? This action is permanent!')) return;
        try {
            const res = await fetch(`/api/challans/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Challan deleted successfully!');
                fetchData();
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting challan');
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (!sortConfig || sortConfig.key !== key) return ' ↕';
        return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    };

    const filteredChallans = challans.filter(ch => 
        (ch.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ch.challan_no || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedChallans = [...filteredChallans].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        
        let valA = a[key];
        let valB = b[key];
        
        if (key === 'total_quantity') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="panel">
            {mode === 'list' && (
                <>
                    <div className="panel-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="panel-title">Delivery Challans</h2>
                            <button className="btn btn-primary" onClick={handleInitCreate}>
                                <Plus size={16} /> New Delivery Challan
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Search by customer name or challan number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ flexGrow: 1, padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                            />
                        </div>
                    </div>

                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('challan_no')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Challan No.{getSortIndicator('challan_no')}
                                </th>
                                <th onClick={() => requestSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Date{getSortIndicator('date')}
                                </th>
                                <th onClick={() => requestSort('customer_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Customer Name{getSortIndicator('customer_name')}
                                </th>
                                <th onClick={() => requestSort('total_quantity')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                                    Total Quantity{getSortIndicator('total_quantity')}
                                </th>
                                <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedChallans.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {searchTerm ? 'No challans match your search query.' : 'No challans found. Click "New Delivery Challan" to get started.'}
                                    </td>
                                </tr>
                            ) : (
                                sortedChallans.map((ch) => (
                                    <tr key={ch.id}>
                                        <td className="font-bold">{ch.challan_no}</td>
                                        <td>{formatDate(ch.date, companyConfig?.date_format)}</td>
                                        <td>{ch.customer_name}</td>
                                        <td style={{ textAlign: 'right' }} className="font-bold">{ch.total_quantity}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                                <button className="btn-icon" onClick={() => handleViewChallan(ch.id)} title="View & Print">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn-icon" onClick={() => handleEditChallan(ch.id)} title="Edit Challan">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteChallan(ch.id)} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </>
            )}

            {mode === 'create' && (
                <>
                    <div className="panel-header">
                        <h2 className="panel-title">{editingChallanId ? 'Edit Delivery Challan' : 'Create Delivery Challan'}</h2>
                        <button className="btn btn-secondary" onClick={() => { setMode('list'); setEditingChallanId(null); }}>
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmitChallan}>
                        {/* Meta Grid */}
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Challan Number *</label>
                                <input
                                    type="text"
                                    value={challanForm.challan_no}
                                    onChange={(e) => setChallanForm({ ...challanForm, challan_no: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Challan Date *</label>
                                <input
                                    type="date"
                                    value={challanForm.date}
                                    onChange={(e) => setChallanForm({ ...challanForm, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Reference No.</label>
                                <input
                                    type="text"
                                    value={challanForm.ref_no}
                                    onChange={(e) => setChallanForm({ ...challanForm, ref_no: e.target.value })}
                                    placeholder="e.g. PO-7493"
                                />
                            </div>
                            <div className="form-group">
                                <label>Reference Date</label>
                                <input
                                    type="date"
                                    value={challanForm.ref_date}
                                    onChange={(e) => setChallanForm({ ...challanForm, ref_date: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Vehicle Number</label>
                                <input
                                    type="text"
                                    value={challanForm.vehicle_no}
                                    onChange={(e) => setChallanForm({ ...challanForm, vehicle_no: e.target.value })}
                                    placeholder="e.g. KA-04-AB-1234"
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>Customer Selection *</label>
                                <select 
                                    value={challanForm.customer_id} 
                                    onChange={handleCustomerChange}
                                    required
                                >
                                    <option value="">-- Select Customer from Database --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.state_name})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>Terms of Delivery</label>
                                <input
                                    type="text"
                                    value={challanForm.terms_delivery}
                                    onChange={(e) => setChallanForm({ ...challanForm, terms_delivery: e.target.value })}
                                    placeholder="e.g. F.O.R. Peenya, 30 days credit"
                                />
                            </div>
                        </div>

                        {/* Selected Customer Billing details preview */}
                        {challanForm.customer_id && (
                            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', backgroundColor: 'var(--bg-primary)', fontSize: '0.875rem' }}>
                                <div className="font-bold" style={{ marginBottom: '0.25rem' }}>Ship To Address:</div>
                                <div style={{ whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>{challanForm.customer_address}</div>
                                <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                                    <div><span className="font-bold">GSTIN/UIN:</span> <code>{challanForm.customer_gstin || 'N/A'}</code></div>
                                    <div><span className="font-bold">State:</span> {challanForm.customer_state} ({challanForm.customer_state_code})</div>
                                </div>
                            </div>
                        )}

                        {/* Items Table */}
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '2rem' }}>Challan Line Items</h3>
                        <table className="items-form-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>Sr.</th>
                                    <th>Description of Goods / Service *</th>
                                    <th style={{ width: '150px' }}>HSN/SAC</th>
                                    <th style={{ width: '150px', textAlign: 'right' }}>Quantity</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {challanForm.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'center', fontSize: '0.875rem' }}>{item.sr_no}</td>
                                        <td>
                                            {/* Searchable Combobox */}
                                            <div 
                                                className="combobox-container"
                                                ref={el => comboboxRefs.current[idx] = el}
                                            >
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemRowChange(idx, 'description', e.target.value)}
                                                    onFocus={() => setActiveComboboxRow(idx)}
                                                    placeholder="Type description or search catalog..."
                                                    required
                                                />
                                                {activeComboboxRow === idx && (
                                                    <ul className="combobox-list">
                                                        {goods
                                                            .filter(g => g.name.toLowerCase().includes((item.description || '').toLowerCase()))
                                                            .map(g => (
                                                                <li 
                                                                    key={g.id} 
                                                                    className="combobox-item"
                                                                    onClick={() => handleSelectGood(idx, g)}
                                                                >
                                                                    <div className="font-bold">{g.name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                        HSN: {g.hsn_sac}
                                                                    </div>
                                                                </li>
                                                            ))
                                                        }
                                                        {goods.filter(g => g.name.toLowerCase().includes((item.description || '').toLowerCase())).length === 0 && (
                                                            <li className="combobox-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                                                                No matching items found. (Press tab to keep custom text)
                                                            </li>
                                                        )}
                                                    </ul>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.hsn_sac}
                                                onChange={(e) => handleItemRowChange(idx, 'hsn_sac', e.target.value)}
                                                placeholder="HSN"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0.001"
                                                step="any"
                                                value={item.quantity}
                                                onChange={(e) => handleItemRowChange(idx, 'quantity', e.target.value)}
                                                style={{ textAlign: 'right' }}
                                                required
                                            />
                                        </td>
                                        <td>
                                            <button 
                                                type="button" 
                                                className="btn-icon" 
                                                style={{ color: 'var(--danger)' }}
                                                onClick={() => handleRemoveRow(idx)}
                                                disabled={challanForm.items.length === 1}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <button type="button" className="btn btn-secondary" onClick={handleAddRow} style={{ marginBottom: '1.5rem' }}>
                            <Plus size={16} /> Add Line Item
                        </button>

                        {/* Summary panel */}
                        <div className="invoice-totals">
                            <div className="totals-card">
                                <div className="totals-row" style={{ fontWeight: 600, fontSize: '1rem' }}>
                                    <span>Total Shipment Quantity</span>
                                    <span>{challanForm.total_quantity}</span>
                                </div>
                            </div>
                        </div>

                        {/* Submit Action */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setMode('list')}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                <Save size={16} /> Save and View Challan
                            </button>
                        </div>
                    </form>
                </>
            )}

            {mode === 'preview' && selectedChallan && companyConfig && (
                <ChallanPreview 
                    challan={selectedChallan}
                    companyConfig={companyConfig}
                    onBack={() => {
                        setSelectedChallan(null);
                        setMode('list');
                    }}
                />
            )}
        </div>
    );
}
