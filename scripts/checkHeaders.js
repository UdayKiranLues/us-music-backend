import axios from 'axios';

async function checkHeaders() {
    try {
        const response = await axios.head('http://localhost:5000/uploads/songs/696e15009321d5bc52327619/cover.png');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Headers:', error.response.headers);
        }
    }
}

checkHeaders();
