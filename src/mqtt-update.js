import mqtt from 'mqtt'; // ✅ Let Vite resolve it automatically

// WebSocket connection to MQTT broker
const brokerUrl = 'ws://test.mosquitto.org:8080';
const options = {
  clientId: 'mqtt_js_' + Math.random().toString(16).substr(2, 8),
};

// Create MQTT client instance
const client = mqtt.connect(brokerUrl, options);

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker!');
  client.subscribe('random/topic', (err) => {
    if (err) {
      console.error('❌ Subscription error:', err);
    }
  });
});

client.on('message', (topic, message) => {
  const messageStr = message.toString();
  console.log('📩 MQTT Message received on', topic, ':', messageStr);

  // Update the humidity chart
  const newValue = parseFloat(messageStr);
  if (!isNaN(newValue) && window.humidityChart) {
    const now = new Date().toLocaleTimeString();
    window.humidityChart.data.labels.push(now);
    window.humidityChart.data.datasets[0].data.push(newValue);

    // Limit to the last 20 data points
    if (window.humidityChart.data.labels.length > 20) {
      window.humidityChart.data.labels.shift();
      window.humidityChart.data.datasets[0].data.shift();
    }
    window.humidityChart.update();
  }
});
