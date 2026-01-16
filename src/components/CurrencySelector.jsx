import React, { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { ChevronDown, Globe } from 'lucide-react';

const CurrencySelector = () => {
    const { selectedCountry, setSelectedCountry, countries } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="currency-selector-container" style={{ position: 'relative' }}>
            <button
                className="currency-toggle"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '99px',
                    padding: '6px 14px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: '0.2s',
                    backdropFilter: 'blur(10px)'
                }}
            >
                <img
                    src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
                    alt={selectedCountry.name}
                    style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                />
                <span className="currency-code">{selectedCountry.currency}</span>
                <ChevronDown size={14} style={{ opacity: 0.6, transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
            </button>

            {isOpen && (
                <>
                    <div className="selector-overlay" onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                    <div className="currency-dropdown" style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        background: '#1a1b1e',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '8px',
                        width: '220px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 999,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        animation: 'fadeInUp 0.2s ease-out',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'var(--accent-1) transparent'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#6366f1', padding: '8px 12px', letterSpacing: '1px' }}>
                            SELECT REGION
                        </div>
                        {countries.map((country) => (
                            <button
                                key={country.code}
                                onClick={() => {
                                    setSelectedCountry(country);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: selectedCountry.code === country.code ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: selectedCountry.code === country.code ? '#a5b4fc' : 'rgba(255, 255, 255, 0.8)',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    textAlign: 'left'
                                }}
                            >
                                <img
                                    src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                                    alt={country.name}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600' }}>{country.name}</span>
                                    <span style={{ fontSize: '10px', opacity: 0.5 }}>{country.currency} ({country.symbol})</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default CurrencySelector;
