import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Eye, Save, Edit2 } from 'lucide-react';
import { spellNumber } from '../utils/spellNumber';
import InvoicePreview from './InvoicePreview';
import { formatDate } from '../utils/dateFormatter';
import { useToast } from '../context/ToastContext';

export default function InvoiceForm() {
    const toast = useToast();
    const [invoices, setInvoices] = useState([]);
    const [companyConfig, setCompanyConfig] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [goods, setGoods] = useState([]);
    
    // View modes: 'list', 'create', 'preview'
    const [mode, setMode] = useState('list');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);
    const [customRoundOff, setCustomRoundOff] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Active dropdowns for description comboboxes (tracks row index)
    const [activeComboboxRow, setActiveComboboxRow] = useState(null);
    const comboboxRefs = useRef([]);

    // Invoice Form State
    const [invoiceForm, setInvoiceForm] = useState({
        invoice_no: '',
        date: new Date().toISOString().split('T')[0],
        ref_no: '',
        ref_date: '',
        vehicle_no: '',
        other_ref: '',
        terms_delivery: '',
        create_dc: false,
        customer_id: '',
        customer_name: '',
        customer_address: '',
        customer_state: '',
        customer_state_code: '',
        customer_gstin: '',
        taxable_value: 0,
        cgst_rate: 0,
        cgst_value: 0,
        sgst_rate: 0,
        sgst_value: 0,
        igst_rate: 0,
        igst_value: 0,
        round_off: 0,
        total_value: 0,
        total_words: '',
        items: [
            { sr_no: 1, description: '', hsn_sac: '', quantity: 1, rate: 0, amount: 0 }
        ]
    });

    const fetchData = async () => {
        try {
            const [cfgRes, custRes, goodsRes, invRes] = await Promise.all([
                fetch('/api/config'),
                fetch('/api/customers'),
                fetch('/api/goods'),
                fetch('/api/invoices')
            ]);

            if (cfgRes.ok) setCompanyConfig(await cfgRes.json());
            if (custRes.ok) setCustomers(await custRes.json());
            if (goodsRes.ok) setGoods(await goodsRes.json());
            if (invRes.ok) setInvoices(await invRes.json());
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

    // Handle initial sequence generation when entering 'create' mode
    const handleInitCreate = async () => {
        setEditingInvoiceId(null);
        setCustomRoundOff(null);
        try {
            const res = await fetch('/api/invoices/next-number');
            if (res.ok) {
                const numData = await res.json();
                setInvoiceForm({
                    invoice_no: numData.invoice_no,
                    date: new Date().toISOString().split('T')[0],
                    ref_no: '',
                    ref_date: '',
                    vehicle_no: '',
                    other_ref: '',
                    terms_delivery: '',
                    create_dc: false,
                    customer_id: '',
                    customer_name: '',
                    customer_address: '',
                    customer_state: '',
                    customer_state_code: '',
                    customer_gstin: '',
                    taxable_value: 0,
                    cgst_rate: companyConfig ? companyConfig.cgst_rate : 9.0,
                    cgst_value: 0,
                    sgst_rate: companyConfig ? companyConfig.sgst_rate : 9.0,
                    sgst_value: 0,
                    igst_rate: companyConfig ? companyConfig.igst_rate : 18.0,
                    igst_value: 0,
                    round_off: 0,
                    total_value: 0,
                    total_words: '',
                    items: [
                        { sr_no: 1, description: '', hsn_sac: '', quantity: 1, rate: 0, amount: 0 }
                    ]
                });
                setMode('create');
            }
        } catch (err) {
            console.error('Sequence loading error:', err);
            toast.error('Could not fetch next sequence number.');
        }
    };

    // Populate Customer info
    const handleCustomerChange = (e) => {
        const custId = parseInt(e.target.value) || '';
        if (!custId) {
            setInvoiceForm(prev => ({
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
            
            setInvoiceForm(prev => {
                const updated = {
                    ...prev,
                    customer_id: custId,
                    customer_name: customer.name,
                    customer_address: fullAddress,
                    customer_state: customer.state_name || '',
                    customer_state_code: customer.state_code || '',
                    customer_gstin: customer.gstin || ''
                };
                return calculateTaxes(updated, customRoundOff);
            });
        }
    };

    // Recalculate row amounts and invoice totals
    const calculateTaxes = (formState, userRoundOff = null) => {
        const taxable = formState.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        
        // Determine CGST+SGST vs IGST
        const customerStateCode = String(formState.customer_state_code).trim();
        const companyStateCode = companyConfig ? String(companyConfig.state_code).trim() : '29';
        
        let cgstVal = 0;
        let sgstVal = 0;
        let igstVal = 0;
        
        const isIntraState = customerStateCode === companyStateCode || customerStateCode === '';
        
        if (isIntraState) {
            cgstVal = Math.round((taxable * (formState.cgst_rate / 100)) * 100) / 100;
            sgstVal = Math.round((taxable * (formState.sgst_rate / 100)) * 100) / 100;
        } else {
            igstVal = Math.round((taxable * (formState.igst_rate / 100)) * 100) / 100;
        }
        
        const rawTotal = taxable + cgstVal + sgstVal + igstVal;
        
        let roundedTotal;
        let roundOff;
        
        if (userRoundOff !== null) {
            roundOff = userRoundOff;
            roundedTotal = Math.round((rawTotal + roundOff) * 100) / 100;
        } else {
            roundedTotal = Math.round(rawTotal);
            roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;
        }
        
        return {
            ...formState,
            taxable_value: taxable,
            cgst_value: cgstVal,
            sgst_value: sgstVal,
            igst_value: igstVal,
            round_off: roundOff,
            total_value: roundedTotal,
            total_words: spellNumber(roundedTotal)
        };
    };

    const handleItemRowChange = (index, field, value) => {
        setInvoiceForm(prev => {
            const items = [...prev.items];
            const item = { ...items[index] };
            
            if (field === 'quantity') {
                item.quantity = parseFloat(value) || 0;
            } else if (field === 'rate') {
                item.rate = parseFloat(value) || 0;
            } else {
                item[field] = value;
            }
            
            item.amount = Math.round((item.quantity * item.rate) * 100) / 100;
            items[index] = item;
            
            return calculateTaxes({ ...prev, items }, customRoundOff);
        });
    };

    const handleAddRow = () => {
        setInvoiceForm(prev => {
            const items = [
                ...prev.items,
                { sr_no: prev.items.length + 1, description: '', hsn_sac: '', quantity: 1, rate: 0, amount: 0 }
            ];
            return calculateTaxes({ ...prev, items }, customRoundOff);
        });
    };

    const handleRemoveRow = (index) => {
        setInvoiceForm(prev => {
            if (prev.items.length === 1) return prev; // Keep at least 1 row
            
            const filteredItems = prev.items.filter((_, i) => i !== index);
            const items = filteredItems.map((item, idx) => ({
                ...item,
                sr_no: idx + 1
            }));
            
            return calculateTaxes({ ...prev, items }, customRoundOff);
        });
    };

    const handleSelectGood = (rowIndex, good) => {
        handleItemRowChange(rowIndex, 'description', good.name);
        handleItemRowChange(rowIndex, 'hsn_sac', good.hsn_sac);
        handleItemRowChange(rowIndex, 'rate', good.rate);
        setActiveComboboxRow(null);
    };

    const handleSubmitInvoice = async (e) => {
        e.preventDefault();

        if (!invoiceForm.customer_id) {
            toast.error('Please select a customer.');
            return;
        }

        if (invoiceForm.items.some(item => !item.description.trim())) {
            toast.error('All line items must have a description.');
            return;
        }

        try {
            const url = editingInvoiceId ? `/api/invoices/${editingInvoiceId}` : '/api/invoices';
            const method = editingInvoiceId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoiceForm)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.challan_no) {
                    toast.success(`Invoice generated successfully! Challan ${data.challan_no} also created.`);
                } else {
                    toast.success(editingInvoiceId ? 'Invoice updated successfully!' : 'Invoice generated successfully!');
                }
                
                // Fetch full details of the saved invoice to load preview
                const detailsRes = await fetch(`/api/invoices/${data.id}`);
                if (detailsRes.ok) {
                    const invoiceData = await detailsRes.json();
                    setSelectedInvoice(invoiceData);
                    setMode('preview');
                    setEditingInvoiceId(null);
                    setCustomRoundOff(null);
                    fetchData(); // Reload invoices list
                }
            } else {
                const data = await res.json();
                toast.error(data.detail || 'Failed to submit invoice');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error submitting invoice');
        }
    };

    const handleRoundOffChange = (e) => {
        const valStr = e.target.value;
        if (valStr === '') {
            setCustomRoundOff(null);
            setInvoiceForm(prev => calculateTaxes(prev, null));
        } else {
            const val = parseFloat(valStr) || 0;
            setCustomRoundOff(val);
            setInvoiceForm(prev => calculateTaxes(prev, val));
        }
    };

    const handleEditInvoice = async (id) => {
        try {
            const res = await fetch(`/api/invoices/${id}`);
            if (res.ok) {
                const data = await res.json();
                setInvoiceForm({
                    invoice_no: data.invoice_no,
                    date: data.date,
                    ref_no: data.ref_no || '',
                    ref_date: data.ref_date || '',
                    vehicle_no: data.vehicle_no || '',
                    other_ref: data.other_ref || '',
                    terms_delivery: data.terms_delivery || '',
                    customer_id: data.customer_id,
                    customer_name: data.customer_name,
                    customer_address: data.customer_address,
                    customer_state: data.customer_state,
                    customer_state_code: data.customer_state_code,
                    customer_gstin: data.customer_gstin || '',
                    taxable_value: data.taxable_value,
                    cgst_rate: data.cgst_rate,
                    cgst_value: data.cgst_value,
                    sgst_rate: data.sgst_rate,
                    sgst_value: data.sgst_value,
                    igst_rate: data.igst_rate,
                    igst_value: data.igst_value,
                    round_off: data.round_off,
                    total_value: data.total_value,
                    total_words: data.total_words,
                    items: data.items
                });
                setEditingInvoiceId(id);
                setCustomRoundOff(data.round_off);
                setMode('create');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error fetching invoice details for editing');
        }
    };

    const handleViewInvoice = async (id) => {
        try {
            const res = await fetch(`/api/invoices/${id}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedInvoice(data);
                setMode('preview');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error fetching invoice details');
        }
    };

    const handleDeleteInvoice = async (id) => {
        if (!window.confirm('Are you sure you want to delete this invoice? This action is permanent!')) return;
        try {
            const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Invoice deleted successfully!');
                fetchData();
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting invoice');
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

    // Filter and sort invoices
    const filteredInvoices = invoices.filter(inv => 
        (inv.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.invoice_no || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        
        let valA = a[key];
        let valB = b[key];
        
        if (key === 'total_value') {
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
                            <h2 className="panel-title">Invoices Dashboard</h2>
                            <button className="btn btn-primary" onClick={handleInitCreate}>
                                <Plus size={16} /> New Tax Invoice
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Search by customer/company name or invoice number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ flexGrow: 1, padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                            />
                        </div>
                    </div>

                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('invoice_no')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Invoice No.{getSortIndicator('invoice_no')}
                                </th>
                                <th onClick={() => requestSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Date{getSortIndicator('date')}
                                </th>
                                <th onClick={() => requestSort('customer_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Customer Name{getSortIndicator('customer_name')}
                                </th>
                                <th onClick={() => requestSort('total_value')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                                    Total Value{getSortIndicator('total_value')}
                                </th>
                                <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {searchTerm ? 'No invoices match your search query.' : 'No invoices found. Click "New Tax Invoice" to get started.'}
                                    </td>
                                </tr>
                            ) : (
                                sortedInvoices.map((inv) => (
                                    <tr key={inv.id}>
                                        <td className="font-bold">{inv.invoice_no}</td>
                                        <td>{formatDate(inv.date, companyConfig?.date_format)}</td>
                                        <td>{inv.customer_name}</td>
                                        <td style={{ textAlign: 'right' }} className="font-bold">₹{inv.total_value.toFixed(2)}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                                <button className="btn-icon" onClick={() => handleViewInvoice(inv.id)} title="View & Print">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn-icon" onClick={() => handleEditInvoice(inv.id)} title="Edit Invoice">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteInvoice(inv.id)} title="Delete">
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
                        <h2 className="panel-title">{editingInvoiceId ? 'Edit Tax Invoice' : 'Create Tax Invoice'}</h2>
                        <button className="btn btn-secondary" onClick={() => { setMode('list'); setEditingInvoiceId(null); setCustomRoundOff(null); }}>
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmitInvoice}>
                        {/* Meta Grid */}
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Invoice Number *</label>
                                <input
                                    type="text"
                                    value={invoiceForm.invoice_no}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_no: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Invoice Date *</label>
                                <input
                                    type="date"
                                    value={invoiceForm.date}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Reference No.</label>
                                <input
                                    type="text"
                                    value={invoiceForm.ref_no}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, ref_no: e.target.value })}
                                    placeholder="e.g. PO-7493"
                                />
                            </div>
                            <div className="form-group">
                                <label>Reference Date</label>
                                <input
                                    type="date"
                                    value={invoiceForm.ref_date}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, ref_date: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Vehicle Number</label>
                                <input
                                    type="text"
                                    value={invoiceForm.vehicle_no}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, vehicle_no: e.target.value })}
                                    placeholder="e.g. KA-04-AB-1234"
                                />
                            </div>
                            <div className="form-group">
                                <label>Other Reference</label>
                                <input
                                    type="text"
                                    value={invoiceForm.other_ref}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, other_ref: e.target.value })}
                                    placeholder="e.g. Plain text reference"
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>Customer Selection *</label>
                                <select 
                                    value={invoiceForm.customer_id} 
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
                                    value={invoiceForm.terms_delivery}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, terms_delivery: e.target.value })}
                                    placeholder="e.g. F.O.R. Peenya, 30 days credit"
                                />
                            </div>
                        </div>

                        {/* Selected Customer Billing details preview */}
                        {invoiceForm.customer_id && (
                            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', backgroundColor: 'var(--bg-primary)', fontSize: '0.875rem' }}>
                                <div className="font-bold" style={{ marginBottom: '0.25rem' }}>Bill To Address:</div>
                                <div style={{ whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>{invoiceForm.customer_address}</div>
                                <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                                    <div><span className="font-bold">GSTIN/UIN:</span> <code>{invoiceForm.customer_gstin || 'N/A'}</code></div>
                                    <div><span className="font-bold">State:</span> {invoiceForm.customer_state} ({invoiceForm.customer_state_code})</div>
                                </div>
                            </div>
                        )}

                        {/* Items Table */}
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '2rem' }}>Line Items</h3>
                        <table className="items-form-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>Sr.</th>
                                    <th>Description of Goods / Service *</th>
                                    <th style={{ width: '120px' }}>HSN/SAC</th>
                                    <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                                    <th style={{ width: '120px', textAlign: 'right' }}>Rate (₹)</th>
                                    <th style={{ width: '120px', textAlign: 'right' }}>Amount (₹)</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceForm.items.map((item, idx) => (
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
                                                                        HSN: {g.hsn_sac} | Rate: ₹{g.rate}
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
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.rate}
                                                onChange={(e) => handleItemRowChange(idx, 'rate', e.target.value)}
                                                style={{ textAlign: 'right' }}
                                                required
                                            />
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, paddingRight: '1rem' }}>
                                            ₹{item.amount.toFixed(2)}
                                        </td>
                                        <td>
                                            <button 
                                                type="button" 
                                                className="btn-icon" 
                                                style={{ color: 'var(--danger)' }}
                                                onClick={() => handleRemoveRow(idx)}
                                                disabled={invoiceForm.items.length === 1}
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

                        {/* Summary & Calculations Panel */}
                        <div className="invoice-totals">
                            <div className="totals-card">
                                <div className="totals-row">
                                    <span>Subtotal (Taxable Value)</span>
                                    <span className="font-bold">₹{invoiceForm.taxable_value.toFixed(2)}</span>
                                </div>
                                {invoiceForm.cgst_value > 0 && (
                                    <>
                                        <div className="totals-row">
                                            <span>CGST @ {invoiceForm.cgst_rate}%</span>
                                            <span>₹{invoiceForm.cgst_value.toFixed(2)}</span>
                                        </div>
                                        <div className="totals-row">
                                            <span>SGST @ {invoiceForm.sgst_rate}%</span>
                                            <span>₹{invoiceForm.sgst_value.toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                                {invoiceForm.igst_value > 0 && (
                                    <div className="totals-row">
                                        <span>IGST @ {invoiceForm.igst_rate}%</span>
                                        <span>₹{invoiceForm.igst_value.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="totals-row" style={{ alignItems: 'center' }}>
                                    <span>Round off</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={customRoundOff !== null ? customRoundOff : invoiceForm.round_off}
                                        onChange={handleRoundOffChange}
                                        style={{ width: '80px', textAlign: 'right', padding: '2px 6px', fontSize: '0.875rem' }}
                                    />
                                </div>
                                <div className="totals-row grand-total">
                                    <span>Total Invoice Value</span>
                                    <span>₹{invoiceForm.total_value.toFixed(2)}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                                    <strong>In Words:</strong> {invoiceForm.total_words}
                                </div>
                            </div>
                        </div>

                        {/* Submit Action */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="create_dc"
                                    checked={invoiceForm.create_dc || false}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, create_dc: e.target.checked })}
                                    style={{ width: 'auto', cursor: 'pointer' }}
                                />
                                <label htmlFor="create_dc" style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    Generate Delivery Challan automatically for this invoice
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setMode('list')}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <Save size={16} /> Save and View Invoice
                                </button>
                            </div>
                        </div>
                    </form>
                </>
            )}

            {mode === 'preview' && selectedInvoice && companyConfig && (
                <InvoicePreview 
                    invoice={selectedInvoice}
                    companyConfig={companyConfig}
                    onBack={() => {
                        setSelectedInvoice(null);
                        setMode('list');
                    }}
                />
            )}
        </div>
    );
}
