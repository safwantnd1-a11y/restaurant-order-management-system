import axios from 'axios';

async function testPlaceOrder() {
  try {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'waiter@testy.com',
      password: 'password123'
    });
    const token = loginRes.data.token;
    
    console.log('Logged in. Token:', token);
    
    const orderRes = await axios.post('http://localhost:3000/api/orders', {
      table_id: 1,
      items: [{ menu_id: 1, quantity: 1, portion: 'full' }],
      total_price: 0
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Order PLACED!', orderRes.data);
  } catch (err: any) {
    if (err.response) {
      console.error('SERVER ERROR REPSONSE:', err.response.data);
    } else {
      console.error('ERROR:', err.message);
    }
  }
}

testPlaceOrder();
