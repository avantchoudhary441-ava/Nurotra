import React from 'react';
import IconAccount from '~icons/mdi/account';
import IconHome from '~icons/mdi/home';
import IconSettings from '~icons/mdi/cog';

const IconTest = () => {
    return (
        <div style={{ padding: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <h2>Icon Test:</h2>
            <IconHome style={{ fontSize: '24px', color: 'blue' }} />
            <IconAccount style={{ fontSize: '24px', color: 'green' }} />
            <IconSettings style={{ fontSize: '24px', color: 'red' }} />
            <p>If you see icons above, the integration is working!</p>
        </div>
    );
};

export default IconTest;
