import React, { createContext, useContext, useState, useEffect } from 'react';

const CurrencyContext = createContext();

export const COUNTRIES = [
    { name: 'India', code: 'IN', currency: 'INR', symbol: '₹', rate: 1 },
    { name: 'USA', code: 'US', currency: 'USD', symbol: '$', rate: 0.012 },
    { name: 'UK', code: 'GB', currency: 'GBP', symbol: '£', rate: 0.0094 },
    { name: 'UAE', code: 'AE', currency: 'AED', symbol: 'د.إ', rate: 0.044 },
    { name: 'Germany', code: 'DE', currency: 'EUR', symbol: '€', rate: 0.011 },
    { name: 'Australia', code: 'AU', currency: 'AUD', symbol: 'A$', rate: 0.018 },
    { name: 'Canada', code: 'CA', currency: 'CAD', symbol: 'C$', rate: 0.016 },
    { name: 'Japan', code: 'JP', currency: 'JPY', symbol: '¥', rate: 1.81 },
    { name: 'Singapore', code: 'SG', currency: 'SGD', symbol: 'S$', rate: 0.016 },
    { name: 'France', code: 'FR', currency: 'EUR', symbol: '€', rate: 0.011 },
    { name: 'Brazil', code: 'BR', currency: 'BRL', symbol: 'R$', rate: 0.060 },
    { name: 'Russia', code: 'RU', currency: 'RUB', symbol: '₽', rate: 1.12 },
    { name: 'South Africa', code: 'ZA', currency: 'ZAR', symbol: 'R', rate: 0.23 }
];

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
    const [selectedCountry, setSelectedCountry] = useState(() => {
        const saved = localStorage.getItem('nuro_country');
        return saved ? JSON.parse(saved) : COUNTRIES[0];
    });

    useEffect(() => {
        localStorage.setItem('nuro_country', JSON.stringify(selectedCountry));
    }, [selectedCountry]);

    const formatCurrency = (amount) => {
        // Simple conversion for demo purposes (usually handled backend)
        const converted = (amount * selectedCountry.rate).toFixed(selectedCountry.currency === 'INR' ? 0 : 2);
        return `${selectedCountry.symbol}${converted}`;
    };

    return (
        <CurrencyContext.Provider value={{
            selectedCountry,
            setSelectedCountry,
            currency: selectedCountry.symbol,
            currencyCode: selectedCountry.currency,
            formatCurrency,
            countries: COUNTRIES
        }}>
            {children}
        </CurrencyContext.Provider>
    );
};
