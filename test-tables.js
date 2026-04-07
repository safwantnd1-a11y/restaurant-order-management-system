import axios from 'axios';

async function test() {
  try {
    const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'admin@system.local', password: 'admin123' });
    const config = { headers: { Authorization: 'Bearer ' + login.data.token } };
    
    console.log('Fetching tables...');
    const tables = await axios.get('http://localhost:5000/api/tables', config);
    console.log('Tables:', tables.data.length);
    
    console.log('Creating table...');
    const add = await axios.post('http://localhost:5000/api/tables', { table_number: 'TEST_TBL_99' }, config);
    console.log('Added:', add.data);
    
    console.log('Assigning table...');
    const assign = await axios.put(`http://localhost:5000/api/tables/${add.data.id}/assign`, { waiter_id: null }, config);
    console.log('Assigned:', assign.data);
    
    console.log('Deleting table...');
    const del = await axios.delete(`http://localhost:5000/api/tables/${add.data.id}`, config);
    console.log('Deleted:', del.data);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
  }
}
test();
