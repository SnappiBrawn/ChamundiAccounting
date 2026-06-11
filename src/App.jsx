import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import InvoiceForm from './components/InvoiceForm';
import ChallanForm from './components/ChallanForm';
import CustomerPanel from './components/CustomerPanel';
import GoodsPanel from './components/GoodsPanel';
import ConfigPage from './components/ConfigPage';
import UpdateNotifier from './components/UpdateNotifier';
import { ToastProvider } from './context/ToastContext';

function App() {
    const [activeTab, setActiveTab] = useState('invoices');
    const [version, setVersion] = useState('');

    useEffect(() => {
        const fetchVersion = async () => {
            try {
                const response = await fetch('/api/system/version');
                if (response.ok) {
                    const data = await response.json();
                    setVersion(data.version);
                }
            } catch (error) {
                console.error("Failed to fetch version:", error);
            }
        };
        fetchVersion();
    }, []);

    const renderContent = () => {
        switch (activeTab) {
            case 'invoices':
                return <InvoiceForm />;
            case 'challans':
                return <ChallanForm />;
            case 'customers':
                return <CustomerPanel />;
            case 'goods':
                return <GoodsPanel />;
            case 'config':
                return <ConfigPage />;
            default:
                return <InvoiceForm />;
        }
    };

    return (
        <ToastProvider>
            <div className="app-container">
                <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
                <main className="main-content">
                    {renderContent()}
                </main>
                <UpdateNotifier />
                {version && (
                    <div className="app-version-label">
                        {version}
                    </div>
                )}
            </div>
        </ToastProvider>
    );
}

export default App;
