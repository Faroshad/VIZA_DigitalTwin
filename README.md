# VIZA_DigitalTwin
This project is an interactive digital twin model for concrete curing, powered by Arduino-based IoT sensors and visualized using Three.js.

1. Install packages
-------------------------
npm i -D vite
-------------------------
npm i three
-------------------------

2. Run the development server
-------------------------
npm start
-------------------------

3. Build(create files for deployment)
-------------------------
npm run build
-------------------------
------------------------------------------------------

🚀 How to Run
To run the project, you must open the welcome.html page with Live Server:
🔹 Right-click welcome.html > "Open with Live Server" (VS Code recommended).


📂 Project Structure
File	Description
index.html	Main page for the 3D visualization & dashboard
welcome.html	Welcome screen before entering the simulation
main.js	Three.js logic – loads FBX models, applies grid mapping, handles shadows & interactions
chart.js	Chart.js logic – creates temperature, humidity, and curing progress charts
main.css	Styling for the UI, including Glassmorphism effects, charts, and buttons
models/	Folder containing FBX 3D models and icons