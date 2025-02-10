document.addEventListener("DOMContentLoaded", function() {
    new Chart(document.getElementById("tempChart"), {
        type: "bar",
        data: {
            labels: ["Morning", "Afternoon", "Evening", "Night"],
            datasets: [{
                label: "Temperature (°C)",
                data: [20, 25, 22, 18],
                backgroundColor: ["#2589bd", "#187795", "#38686a", "#a3b4a2"]
            }]
        }
    });

    new Chart(document.getElementById("cureTimeChart"), {
        type: "pie",
        data: {
            labels: ["Completed", "Remaining"],
            datasets: [{
                data: [14.2, 10],
                backgroundColor: ["#187795", "#a3b4a2",]
            }]
        }
    });

    new Chart(document.getElementById("humidityChart"), {
        type: "line",
        data: {
            labels: ["0h", "4h", "8h", "12h", "16h", "20h"],
            datasets: [{
                label: "Humidity (%)",
                data: [80, 75, 78, 82, 85, 79],
                borderColor: "#2589bd",
                fill: false
            }]
        }
    });
});
