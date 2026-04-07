import axios from 'axios';

async function test() {
  try {
    const login = await axios.post('http://localhost:3000/api/auth/login', { email: 'admin@system.local', password: 'admin123' });
    const config = { headers: { Authorization: 'Bearer ' + login.data.token } };
    
    // Test creating a table
    try {
      const add = await axios.post('http://localhost:3000/api/tables', { table_number: 'TEST_TBL_99' }, config);
      console.log('Added:', add.data);
      
      const assign = await axios.put(`http://localhost:3000/api/tables/${add.data.id}/assign`, { waiter_id: null }, config);
      console.log('Assigned:', assign.data);
      
      const del = await axios.delete(`http://localhost:3000/api/tables/${add.data.id}`, config);
      console.log('Deleted:', del.data);
    } catch(err) {
      console.log('Table Error:', err.response?.data || err.message);
    }

    // Try fetching tables
    const res = await axios.get('http://localhost:3000/api/tables', config);
    console.log('Tables fetched:', res.data.length);
  } catch (err) {
    console.error('Login/General Error:', err.response?.status, err.response?.data || err.message);
  }
}
test();
