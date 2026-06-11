import React, { useState, useEffect } from 'react';
import { DownloadCloud, X, AlertTriangle } from 'lucide-react';

export default function UpdateNotifier() {
    const [updateInfo, setUpdateInfo] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [downloadState, setDownloadState] = useState('idle'); // 'idle' | 'downloading' | 'error' | 'success'
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                const response = await fetch('/api/system/check-update');
                if (!response.ok) return;
                const data = await response.json();
                
                if (data.update_available && data.download_url) {
                    setUpdateInfo(data);
                    setIsVisible(true);
                }
            } catch (error) {
                console.error("Failed to check for updates:", error);
            }
        };

        checkForUpdates();
    }, []);

    if (!isVisible || !updateInfo) return null;

    const handleUpdateClick = async () => {
        setDownloadState('downloading');
        setErrorMessage('');
        try {
            const response = await fetch('/api/system/download-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ download_url: updateInfo.download_url }),
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.message && data.message.includes('Simulation')) {
                    setDownloadState('idle');
                    alert(`Simulation: update process completed successfully!\n(URL: ${updateInfo.download_url})`);
                    setIsVisible(false);
                } else {
                    setDownloadState('success');
                }
            } else {
                let msg = "Failed to download update.";
                try {
                    const errorData = await response.json();
                    msg = errorData.detail || msg;
                } catch (_) {}
                setDownloadState('error');
                setErrorMessage(msg);
            }
        } catch (error) {
            // In frozen mode, the backend shuts down immediately to swap the exe.
            // This aborts/resets the connection, which throws a network error on the frontend.
            // We treat this as success (app is restarting).
            console.log("Connection closed/reset, app should be restarting:", error);
            setDownloadState('success');
        }
    };

    return (
        <div className="update-notifier">
            <div className="update-header">
                <span className="update-title">
                    <DownloadCloud size={16} style={{ color: 'var(--accent)' }} />
                    Update Available
                </span>
                {downloadState !== 'downloading' && (
                    <button onClick={() => setIsVisible(false)} className="update-close" title="Dismiss">
                        <X size={14} />
                    </button>
                )}
            </div>

            <div className="update-body">
                {downloadState === 'idle' && (
                    <>
                        Version <span className="update-version">{updateInfo.latest_version}</span> is available (current: {updateInfo.current_version}).
                        {updateInfo.release_notes && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', maxHeight: '60px', overflowY: 'auto', borderLeft: '2px solid var(--border-color)', paddingLeft: '0.5rem' }}>
                                {updateInfo.release_notes}
                            </div>
                        )}
                    </>
                )}

                {downloadState === 'downloading' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span>Downloading new version and restarting...</span>
                    </div>
                )}

                {downloadState === 'success' && (
                    <span style={{ color: 'var(--success)', fontWeight: '600' }}>
                        Restarting app now...
                    </span>
                )}

                {downloadState === 'error' && (
                    <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', fontSize: '0.75rem' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{errorMessage || "An error occurred during update."}</span>
                    </div>
                )}
            </div>

            {downloadState !== 'success' && (
                <button
                    onClick={handleUpdateClick}
                    disabled={downloadState === 'downloading'}
                    className="update-btn"
                >
                    {downloadState === 'downloading' ? 'Downloading...' : downloadState === 'error' ? 'Retry Download' : 'Download & Restart'}
                </button>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
