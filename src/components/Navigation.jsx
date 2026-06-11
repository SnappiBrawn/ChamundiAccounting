import { FileText, Users, Package, Settings, Truck } from 'lucide-react';

import Logo from '../assets/Logo.png';

export default function Navigation({ activeTab, setActiveTab }) {
    const tabs = [
        { id: 'invoices', label: 'Invoices', icon: FileText },
        { id: 'challans', label: 'Delivery Challans', icon: Truck },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'goods', label: 'Goods / Services', icon: Package },
        { id: 'config', label: 'Settings', icon: Settings },
    ];

    return (
        <nav className="navbar">
            <div className="nav-brand">
                <img src={Logo} alt="Logo" style={{ height: '28px', width: 'auto', borderRadius: '4px' }} />
                <span>Chamundi Accounting</span>
            </div>
            <div className="nav-links">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Icon size={16} />
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
