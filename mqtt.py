import paho.mqtt.client as mqtt
import time
import pandas as pd

import pandas as pd
import matplotlib.pyplot as plt


# MQTT Broker 
broker = "broker.hivemq.com"
port = 1883
topic = "ue5/test"

broker = "127.0.0.1"


broker = "test.mosquitto.org"
port = 1883
topic = "ue5/test" 
client = mqtt.Client()
client.connect('localhost', 1883, 60)
messages = pd.read_csv(r'D:\autocad\concrete_data\data.csv', parse_dates=["timestamp"])

# Simplify the plot
plt.figure(figsize=(10, 5))
plt.plot(messages["timestamp"], messages["dht_temp"], label="Air Temp (DHT11)")
plt.plot(messages["timestamp"], messages["ds18_1"], label="Concrete Temp 1")
plt.plot(messages["timestamp"], messages["dht_hum"], label="Air Humidity (%)")
plt.xticks(rotation=45)
plt.xlabel("Time")
plt.ylabel("Value")
plt.title("Sensor Data Over Time")
plt.legend()
plt.tight_layout()
plt.grid(True)
plt.show() 
# water 
print("time: ", messages['timestamp'].max(),messages['timestamp'].min())
print("dht_hum: ", messages['dht_hum'].max(),messages['dht_hum'].min()) # air hum -> blue denity
print("dht_temp: ", messages['dht_temp'].max(),messages['dht_temp'].min()) # air temp -> blue ga color
print("oil: ", messages['soil'].max(),messages['soil'].min()) # concrete hum -> concrete mat change
print("ds18_1: ", messages['ds18_1'].max(),messages['ds18_1'].min()) # concrete temp -> concrete mat change


for i in range(len(messages)):
    message = messages.iloc[i].to_dict()
    row_string = ",".join(f"{k}={v}" for k, v in message.items())
    client.publish(topic,  row_string)
    print("Sent:", message)
    time.sleep(1)


client.disconnect()



