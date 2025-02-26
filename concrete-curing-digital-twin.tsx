import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart, Bar, Scatter } from 'recharts';

const ConcreteCuringDashboard = () => {
  // State for simulation control
  const [isRunning, setIsRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(60); // minutes per second
  const [currentTime, setCurrentTime] = useState(0); // hours
  const [elapsedRealTime, setElapsedRealTime] = useState(0);
  const [activeTab, setActiveTab] = useState('temperature');
  const [isLoading, setIsLoading] = useState(true);
  
  // State for maturity method selection
  const [maturityMethod, setMaturityMethod] = useState('nurse-saul'); // 'nurse-saul', 'equivalent-age', 'weighted'
  const [datumTemperature, setDatumTemperature] = useState(0); // °C for Nurse-Saul
  const [activationEnergy, setActivationEnergy] = useState(5000); // K for Equivalent Age
  const [cValue, setCValue] = useState(1.5); // for Weighted Maturity
  
  // State for mix design selection
  const [selectedMix, setSelectedMix] = useState('default');

  // State for ROI calculator
  const [projectVolume, setProjectVolume] = useState(4000); // m³
  const [numberOfPours, setNumberOfPours] = useState(20);
  const [averageTestCost, setAverageTestCost] = useState(900); // $ per pour
  const [delayDays, setDelayDays] = useState(10); // days
  const [dailyCost, setDailyCost] = useState(10000); // $ per day
  
  // State for simulation data
  const [simulationParameters, setSimulationParameters] = useState({
    // Concrete mix properties
    mix: {
      cement_content: 350, // kg/m3
      water_content: 175, // kg/m3
      w_c_ratio: 0.5, // water-cement ratio
      ultimate_strength: 40, // MPa
      rate_constant: 0.0025, // for strength prediction
      ultimate_hydration: 0.7, // maximum degree of hydration
      tensile_strength_factor: 0.1, // approximate ratio of tensile to compressive strength
      modulus_elasticity: 30000, // MPa
      thermal_expansion: 10e-6, // coefficient of thermal expansion per °C
      creep_factor: 1.0 // for thermal stress calculation
    },
    
    // Element geometry
    geometry: {
      type: 'slab',
      thickness: 250, // mm
      length: 6000, // mm 
      width: 3000, // mm
      volume: 4.5 // m3
    },
    
    // Formwork properties
    formwork: {
      material: 'plywood',
      k_value: 0.12, // W/m·K (thermal conductivity)
      thickness: 18, // mm
      thermal_resistance: 0.15, // m²·K/W
      emissivity: 0.9
    },
    
    // Initial conditions
    initial: {
      concrete_temp: 22, // °C (initial concrete temperature)
      ambient_temp: 18, // °C (initial ambient temperature)
      ambient_humidity: 65, // % (initial ambient relative humidity)
      wind_speed: 2.5, // m/s (initial wind speed)
      pour_time: new Date("2025-02-24T08:00:00") // Pour date and time
    },
    
    // Simulation parameters
    simulation: {
      duration: 168, // hours (7 days)
      time_step: 0.25, // hours (15 min)
      datum_temperature: 0 // °C (datum temperature for maturity calculation)
    },
    
    // Restraint conditions for thermal stress
    restraint: {
      degree: 0.7, // 0-1 scale where 1 is fully restrained
    }
  });
  
  const [ambientData, setAmbientData] = useState([]);
  const [temperatureData, setTemperatureData] = useState([]);
  const [maturityData, setMaturityData] = useState([]);
  const [strengthData, setStrengthData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [riskData, setRiskData] = useState([]);
  
  // Simulation thresholds and current values
  const [currentValues, setCurrentValues] = useState({
    coreTemperature: 0,
    surfaceTemperature: 0,
    ambientTemperature: 0,
    strength: 0,
    tensileStrength: 0,
    maturity: 0,
    humidity: 0,
    thermalGradient: 0,
    evaporationRate: 0,
    hydrationDegree: 0,
    formRemovalReady: false,
    loadingReady: false,
    thermalStress: 0,
    crackingRisk: 'low' // 'low', 'medium', 'high'
  });
  
  // References for animation frame
  const animationFrameRef = useRef();
  const lastUpdateTimeRef = useRef(Date.now());
  
  // Mix design library
  const mixLibrary = {
    'default': {
      name: 'Standard Mix (w/c=0.5)',
      cement_content: 350,
      water_content: 175,
      w_c_ratio: 0.5,
      ultimate_strength: 40,
      rate_constant: 0.0025,
      ultimate_hydration: 0.7,
      tensile_strength_factor: 0.1,
      modulus_elasticity: 30000,
      thermal_expansion: 10e-6,
      creep_factor: 1.0
    },
    'high-strength': {
      name: 'High Strength Mix (w/c=0.4)',
      cement_content: 425,
      water_content: 170,
      w_c_ratio: 0.4,
      ultimate_strength: 60,
      rate_constant: 0.0030,
      ultimate_hydration: 0.65,
      tensile_strength_factor: 0.09,
      modulus_elasticity: 35000,
      thermal_expansion: 9.5e-6,
      creep_factor: 0.9
    },
    'mass-concrete': {
      name: 'Mass Concrete Mix',
      cement_content: 280,
      water_content: 154,
      w_c_ratio: 0.55,
      ultimate_strength: 35,
      rate_constant: 0.0020,
      ultimate_hydration: 0.75,
      tensile_strength_factor: 0.11,
      modulus_elasticity: 28000,
      thermal_expansion: 10.5e-6,
      creep_factor: 1.1
    },
    'rapid-set': {
      name: 'Rapid Setting Mix',
      cement_content: 400,
      water_content: 180,
      w_c_ratio: 0.45,
      ultimate_strength: 50,
      rate_constant: 0.0040,
      ultimate_hydration: 0.6,
      tensile_strength_factor: 0.085,
      modulus_elasticity: 33000,
      thermal_expansion: 10e-6,
      creep_factor: 0.95
    }
  };

  // Handle mix selection
  const handleMixChange = (mixId) => {
    setSelectedMix(mixId);
    const mixProps = mixLibrary[mixId];
    setSimulationParameters(prev => ({
      ...prev,
      mix: {
        ...prev.mix,
        cement_content: mixProps.cement_content,
        water_content: mixProps.water_content,
        w_c_ratio: mixProps.w_c_ratio,
        ultimate_strength: mixProps.ultimate_strength,
        rate_constant: mixProps.rate_constant,
        ultimate_hydration: mixProps.ultimate_hydration,
        tensile_strength_factor: mixProps.tensile_strength_factor,
        modulus_elasticity: mixProps.modulus_elasticity,
        thermal_expansion: mixProps.thermal_expansion,
        creep_factor: mixProps.creep_factor
      }
    }));
    
    // Reset and reinitialize with new mix if simulation has started
    if (currentTime > 0) {
      resetSimulation();
      setTimeout(() => {
        initializeSimulation();
      }, 100);
    }
  };

  // Initialize the simulation
  useEffect(() => {
    const initTimer = setTimeout(() => {
      initializeSimulation();
      
      // Start simulation automatically after a short delay
      setTimeout(() => {
        setIsRunning(true);
        setSimulationSpeed(360); // 6 hours per second
        setIsLoading(false);
      }, 500);
    }, 300);
    
    return () => clearTimeout(initTimer);
  }, []);
  
  // Handle simulation timer
  useEffect(() => {
    if (isRunning) {
      // Start simulation loop
      lastUpdateTimeRef.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(updateSimulation);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isRunning, simulationSpeed, currentTime]);
  
  // Initialize full simulation data
  const initializeSimulation = () => {
    try {
      const ambient = generateAmbientConditions(simulationParameters);
      const temperature = simulateConcreteTemperature(ambient, simulationParameters);
      const maturity = calculateMaturity(temperature, simulationParameters, maturityMethod, datumTemperature, activationEnergy, cValue);
      const strength = calculateStrength(maturity, simulationParameters);
      const humidity = calculateInternalHumidity(temperature, simulationParameters);
      const risk = calculateRiskFactors(temperature, ambient, strength, simulationParameters);
      
      setAmbientData(ambient);
      setTemperatureData(temperature);
      setMaturityData(maturity);
      setStrengthData(strength);
      setHumidityData(humidity);
      setRiskData(risk);
      
      // Set initial values
      updateCurrentValues(0);
    } catch (error) {
      console.error("Error initializing simulation:", error);
      // Handle error gracefully
    }
  };
  
  // Update simulation state based on current time
  const updateSimulation = () => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTimeRef.current) / 1000; // seconds
    lastUpdateTimeRef.current = now;
    
    // Convert real seconds to simulation hours
    // simulationSpeed is in minutes per second, so we divide by 60 to get hours per second
    const simulationDeltaTime = (deltaTime * simulationSpeed) / 60;
    
    // Update current time
    const newTime = Math.min(
      simulationParameters.simulation.duration,
      currentTime + simulationDeltaTime
    );
    
    setCurrentTime(newTime);
    setElapsedRealTime(prev => prev + deltaTime);
    
    // Update current values based on new time
    updateCurrentValues(newTime);
    
    // Continue animation if not at the end
    if (newTime < simulationParameters.simulation.duration && isRunning) {
      animationFrameRef.current = requestAnimationFrame(updateSimulation);
    } else if (newTime >= simulationParameters.simulation.duration) {
      setIsRunning(false);
    }
  };
  
  // Update display values based on current time
  const updateCurrentValues = (time) => {
    try {
      // Find the closest data point for the current time
      const timeStep = simulationParameters.simulation.time_step;
      const index = Math.min(
        Math.floor(time / timeStep),
        temperatureData.length - 1
      );
      
      if (
        index >= 0 && 
        temperatureData[index] && 
        strengthData[index] && 
        humidityData[index] && 
        riskData[index]
      ) {
        setCurrentValues({
          coreTemperature: temperatureData[index].coreTemperature,
          surfaceTemperature: temperatureData[index].surfaceTemperature,
          ambientTemperature: temperatureData[index].ambientTemperature,
          strength: strengthData[index].strength,
          tensileStrength: strengthData[index].tensileStrength,
          maturity: maturityData[index].maturity,
          humidity: humidityData[index].internalHumidity,
          hydrationDegree: humidityData[index].hydrationDegree,
          thermalGradient: riskData[index].thermalGradient,
          evaporationRate: riskData[index].evaporationRate,
          formRemovalReady: strengthData[index].formRemovalReady,
          loadingReady: strengthData[index].loadingReady,
          thermalStress: riskData[index].thermalStress,
          crackingRisk: riskData[index].crackingRisk
        });
      }
    } catch (error) {
      console.error("Error updating values:", error);
      // Handle error gracefully
    }
  };
  
  // Toggle simulation running state
  const toggleSimulation = () => {
    setIsRunning(!isRunning);
  };
  
  // Reset simulation
  const resetSimulation = () => {
    setIsRunning(false);
    setCurrentTime(0);
    setElapsedRealTime(0);
    updateCurrentValues(0);
  };
  
  // Format time display
  const formatTime = (hours) => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };
  
  // Get data slice up to current time for charts
  const getCurrentDataSlice = (dataArray) => {
    if (!dataArray || dataArray.length === 0) return [];
    const timeStep = simulationParameters.simulation.time_step;
    const currentIndex = Math.min(
      Math.floor(currentTime / timeStep),
      dataArray.length - 1
    );
    return dataArray.slice(0, currentIndex + 1);
  };
  
  // Convert temperature risk to color
  const getRiskColor = (risk) => {
    switch(risk) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#22c55e';
    }
  };
  
  // Get strength milestone percentage
  const getStrengthPercentage = () => {
    return Math.min(100, Math.round(currentValues.strength / simulationParameters.mix.ultimate_strength * 100));
  };
  
  // Milestone information
  const getMilestoneInfo = () => {
    const milestones = [
      {
        name: "Formwork Removal",
        threshold: 0.15 * simulationParameters.mix.ultimate_strength,
        reached: currentValues.formRemovalReady,
        time: strengthData.find(d => d.formRemovalReady)?.time
      },
      {
        name: "Loading Ready",
        threshold: 0.75 * simulationParameters.mix.ultimate_strength,
        reached: currentValues.loadingReady,
        time: strengthData.find(d => d.loadingReady)?.time
      }
    ];
    
    return milestones;
  };

  // Calculate ROI
  const calculateROI = () => {
    // Cost of maturity method
    const maturitySensorCost = 2; // $ per m³
    const maturityCalibrationCost = 2000; // $ for one mix
    const totalMaturityCost = projectVolume * maturitySensorCost + maturityCalibrationCost;
    
    // Cost savings from avoiding break tests
    const totalBreakTestCost = numberOfPours * averageTestCost;
    
    // Cost savings from shorter project duration
    const totalDelayCost = delayDays * dailyCost;
    
    // Total savings
    const totalSavings = totalBreakTestCost + totalDelayCost;
    
    // ROI calculation
    const roi = (totalSavings - totalMaturityCost) / totalMaturityCost * 100;
    
    return {
      maturityCost: totalMaturityCost,
      breakTestCost: totalBreakTestCost,
      delayCost: totalDelayCost,
      totalSavings: totalSavings,
      netSavings: totalSavings - totalMaturityCost,
      roi: roi
    };
  };

  // Helper function to calculate saturation vapor pressure
  function calculateSVP(temperature) {
    return 0.6108 * Math.exp(17.27 * temperature / (temperature + 237.3));
  }

  // Generate ambient conditions over time (temperature, humidity, wind)
  function generateAmbientConditions(params) {
    const hours = Math.ceil(params.simulation.duration / params.simulation.time_step);
    const ambientData = [];
    
    for (let i = 0; i < hours; i++) {
      const time = i * params.simulation.time_step;
      const timeOfDay = (params.initial.pour_time.getHours() + time) % 24;
      
      // Simulate diurnal temperature pattern (daily cycle)
      const diurnalAdjustment = 5 * Math.sin((timeOfDay - 13) * Math.PI / 12);
      const temperature = params.initial.ambient_temp + diurnalAdjustment + 
                         0.8 * Math.sin(time * Math.PI / 72) + // Multi-day trend
                         Math.random() * 1.5 - 0.75; // Random noise
      
      // Simulate humidity pattern (inverse to temperature)
      const humidityAdjustment = -10 * Math.sin((timeOfDay - 13) * Math.PI / 12);
      const humidity = Math.max(30, Math.min(95, 
        params.initial.ambient_humidity + humidityAdjustment +
        Math.random() * 5 - 2.5
      ));
      
      // Simulate wind pattern
      const windSpeed = Math.max(0.5, Math.min(8,
        params.initial.wind_speed +
        Math.sin(time * Math.PI / 24) + // Day-night pattern
        Math.random() * 1.0 - 0.5
      ));
      
      const timestamp = new Date(params.initial.pour_time.getTime() + time * 60 * 60 * 1000);
      
      ambientData.push({
        time,
        timestamp,
        temperature,
        humidity,
        windSpeed
      });
    }
    
    return ambientData;
  }

  // Calculate heat generation from hydration
  function calculateHeatGeneration(time, params) {
    // Base heat of hydration for portland cement is around 500 J/g
    const baseHeat = 250; // J/g (adjusted for realistic heat generation)
    
    // Calculate hydration degree using exponential model
    const tau = 15; // hours
    const beta = 0.8;
    
    // Hydration degree using exponential model
    const hydrationDegree = params.mix.ultimate_hydration * 
                          Math.exp(-Math.pow(tau / (time + 0.1), beta));
    
    // Calculate heat generation rate with time-dependent factor
    // First day has more intense heat generation
    const timeFactor = Math.exp(-time / 24);
    
    // Convert cement content from kg/m3 to g/m3 with realistic scaling
    const heatGeneration = hydrationDegree * params.mix.cement_content * 1000 * baseHeat * timeFactor * 0.002;
    
    return {
      hydrationDegree,
      heatGeneration // J/m3
    };
  }

  // Calculate concrete temperature over time
  function simulateConcreteTemperature(ambientData, params) {
    const temperatureData = [];
    let currentTemp = params.initial.concrete_temp;
    
    // Heat capacity of concrete approximately 1000 J/kg·°C
    const heatCapacity = 1000; // J/kg·°C
    // Density of concrete approximately 2400 kg/m3
    const density = 2400; // kg/m3
    // Thermal conductivity factor (simplified)
    const coolingFactor = 0.08; // simplified cooling rate factor
    
    // Initial ambient temperature
    const initialAmbientTemp = ambientData[0].temperature;
    
    for (let i = 0; i < ambientData.length; i++) {
      const time = ambientData[i].time;
      const ambientTemp = ambientData[i].temperature;
      const windSpeed = ambientData[i].windSpeed;
      
      // Heat generation from hydration
      const { hydrationDegree, heatGeneration } = calculateHeatGeneration(time, params);
      
      // Adiabatic temperature rise (realistic modeling based on cement content)
      // Most concrete has adiabatic temperature rise of 10-25°C
      const maxTempRise = 25; // Maximum temperature rise in °C
      
      // Temperature rise follows S-curve pattern over first ~2 days
      const tempRiseFactor = hydrationDegree * Math.exp(-time / 48);
      const targetTemp = initialAmbientTemp + maxTempRise * tempRiseFactor;
      
      // Adjust cooling rate based on wind and temperature differential
      // Higher differential means faster cooling
      const tempDifferential = currentTemp - ambientTemp;
      const heatLoss = coolingFactor * tempDifferential * (1 + windSpeed / 20);
      
      // Realistic balance between hydration heating and environment cooling
      // First, calculate an ideal temperature based on hydration stage
      const idealTemp = initialAmbientTemp + maxTempRise * hydrationDegree * Math.exp(-time / 72);
      
      // Then gradually move current temperature toward this ideal temperature
      const adjustmentRate = 0.1 * params.simulation.time_step;
      
      if (time < 48) { // First 48 hours - heating dominates
        currentTemp = currentTemp + (targetTemp - currentTemp) * adjustmentRate - heatLoss * 0.2 * params.simulation.time_step;
      } else { // After 48 hours - cooling dominates
        currentTemp = currentTemp - heatLoss * params.simulation.time_step;
      }
      
      // Calculate temperature at different locations (center, surface)
      // Surface is more affected by ambient conditions
      const surfaceTemp = ambientTemp + (currentTemp - ambientTemp) * 0.7;
      
      temperatureData.push({
        time,
        timestamp: ambientData[i].timestamp,
        hydrationDegree,
        coreTemperature: currentTemp,
        surfaceTemperature: surfaceTemp,
        ambientTemperature: ambientTemp
      });
    }
    
    return temperatureData;
  }

  // Calculate maturity using selected method
  function calculateMaturity(temperatureData, params, method, datumTemp, activationE, cVal) {
    const maturityData = [];
    let maturity = 0;
    
    for (let i = 0; i < temperatureData.length; i++) {
      const time = temperatureData[i].time;
      const coreTemp = temperatureData[i].coreTemperature;
      const timeStep = params.simulation.time_step;
      
      // Calculate maturity based on selected method
      if (method === 'nurse-saul') {
        // Nurse-Saul method (temperature-time factor)
        const increment = Math.max(0, coreTemp - datumTemp) * timeStep;
        maturity += increment;
      } 
      else if (method === 'equivalent-age') {
        // Equivalent Age method (Arrhenius equation)
        const referenceTemp = 23; // °C
        const increment = Math.exp(-activationE * (1/(coreTemp + 273.15) - 1/(referenceTemp + 273.15))) * timeStep;
        maturity += increment;
      }
      else if (method === 'weighted') {
        // Weighted Maturity method
        if (i > 0) {
          const n = 0.1 * coreTemp - 1.245;
          const increment = (10 * (Math.pow(cVal, 0.1 * coreTemp - 1.245) - Math.pow(cVal, -1.245)) / Math.log(cVal)) * timeStep;
          maturity += increment;
        }
      }
      
      maturityData.push({
        time,
        timestamp: temperatureData[i].timestamp,
        maturity
      });
    }
    
    return maturityData;
  }

  // Calculate concrete strength using maturity
  function calculateStrength(maturityData, params) {
    const strengthData = [];
    
    for (let i = 0; i < maturityData.length; i++) {
      const time = maturityData[i].time;
      const maturity = maturityData[i].maturity;
      
      // Calculate strength using exponential model
      const strength = params.mix.ultimate_strength * 
                     (1 - Math.exp(-params.mix.rate_constant * maturity));
      
      // Calculate tensile strength (typically 10% of compressive)
      const tensileStrength = strength * params.mix.tensile_strength_factor;
      
      // Calculate various strength thresholds
      const formRemovalReady = strength >= 0.15 * params.mix.ultimate_strength;
      const loadingReady = strength >= 0.75 * params.mix.ultimate_strength;
      
      strengthData.push({
        time,
        timestamp: maturityData[i].timestamp,
        strength,
        tensileStrength,
        formRemovalReady,
        loadingReady
      });
    }
    
    return strengthData;
  }

  // Calculate internal humidity
  function calculateInternalHumidity(temperatureData, params) {
    const humidityData = [];
    let internalHumidity = 100; // Start at 100%
    
    for (let i = 0; i < temperatureData.length; i++) {
      const time = temperatureData[i].time;
      const hydrationDegree = temperatureData[i].hydrationDegree;
      
      // Humidity decreases as hydration progresses and from evaporation
      // This is a simplified model
      const hydrationEffect = 5 * (hydrationDegree - temperatureData[Math.max(0, i-1)].hydrationDegree);
      const evaporationEffect = 0.02 * Math.sqrt(time + 1);
      
      // Update internal humidity
      internalHumidity = Math.max(40, internalHumidity - hydrationEffect - evaporationEffect);
      
      humidityData.push({
        time,
        timestamp: temperatureData[i].timestamp,
        internalHumidity,
        hydrationDegree
      });
    }
    
    return humidityData;
  }

  // Calculate risk factors (thermal cracking, evaporation)
  function calculateRiskFactors(temperatureData, ambientData, strengthData, params) {
    const riskData = [];
    
    for (let i = 0; i < temperatureData.length; i++) {
      const time = temperatureData[i].time;
      const coreTemp = temperatureData[i].coreTemperature;
      const surfaceTemp = temperatureData[i].surfaceTemperature;
      const ambientTemp = ambientData[i].temperature;
      const windSpeed = ambientData[i].windSpeed;
      const humidity = ambientData[i].humidity;
      const tensileStrength = strengthData[i]?.tensileStrength || 0;
      
      // Calculate thermal gradient - realistic for concrete (usually 5-20°C difference)
      const thermalGradient = Math.abs(coreTemp - surfaceTemp);
      
      // Calculate evaporation rate using Penman formula - realistic scale
      const surfaceSVP = calculateSVP(surfaceTemp);
      const ambientSVP = calculateSVP(ambientTemp);
      const airVP = ambientSVP * humidity / 100;
      const evaporationRate = 5.9 * (surfaceSVP - airVP) * (0.5 + 0.35 * windSpeed) / 1000;
      
      // Calculate thermal stress using the formula from section 6.1.3
      // thermalStress = thermalGradient * E * CTE * R / C
      // where E is modulus of elasticity, CTE is coefficient of thermal expansion
      // R is degree of restraint, C is creep factor
      const thermalStress = thermalGradient * 
                           params.mix.modulus_elasticity * 
                           params.mix.thermal_expansion * 
                           params.restraint.degree / 
                           params.mix.creep_factor;
      
      // Calculate cracking risk by comparing thermal stress to tensile strength
      let crackingRisk = 'low';
      if (thermalStress > tensileStrength * 0.7) {
        crackingRisk = thermalStress > tensileStrength * 0.9 ? 'high' : 'medium';
      }
      
      // Calculate risk levels with realistic thresholds
      const thermalCrackingRisk = thermalGradient > 20 ? 'high' : 
                                thermalGradient > 15 ? 'medium' : 'low';
      
      const evaporationRisk = evaporationRate > 0.5 ? 'high' :
                            evaporationRate > 0.2 ? 'medium' : 'low';
      
      // DEF risk (delayed ettringite formation - occurs at high temperatures)
      // Typically a concern when concrete exceeds 70°C
      const defRisk = coreTemp > 70 ? 'high' :
                     coreTemp > 60 ? 'medium' : 'low';
      
      // Freezing risk
      const freezingRisk = surfaceTemp < 5 ? 'high' : 
                         surfaceTemp < 10 ? 'medium' : 'low';
      
      riskData.push({
        time,
        timestamp: temperatureData[i].timestamp,
        thermalGradient,
        evaporationRate,
        thermalStress,
        crackingRisk,
        thermalCrackingRisk,
        evaporationRisk,
        defRisk,
        freezingRisk
      });
    }
    
    return riskData;
  }

  // If loading, show a loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-2xl font-bold mb-4">Initializing Concrete Curing Digital Twin</div>
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Preparing simulation data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 gap-6 bg-gray-50 min-h-screen">
      <header className="pb-2">
        <h1 className="text-2xl font-bold">Concrete Curing Digital Twin</h1>
        <p className="text-sm text-gray-500">Real-time monitoring and prediction of concrete curing behavior</p>
      </header>
      
      {/* Simulation Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              className={`p-2 rounded-full ${isRunning ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}
              onClick={toggleSimulation}
              aria-label={isRunning ? "Pause simulation" : "Play simulation"}
            >
              {isRunning ? "Pause" : "Play"}
            </button>
            <button 
              className="p-2 rounded-full bg-gray-200"
              onClick={resetSimulation}
              aria-label="Reset simulation"
            >
              Reset
            </button>
          </div>
          
          <div className="flex-1 px-4">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>Simulation Speed</span>
              <span>
                {simulationSpeed >= 60 
                  ? `${Math.round(simulationSpeed/60)} hour${Math.round(simulationSpeed/60) !== 1 ? 's' : ''}/sec` 
                  : `${simulationSpeed} min/sec`}
              </span>
            </div>
            <input 
              type="range"
              min="10"
              max="1440"
              step="10"
              value={simulationSpeed}
              onChange={(e) => setSimulationSpeed(Number(e.target.value))}
              className="w-full"
              aria-label="Adjust simulation speed"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>10 min/sec</span>
              <span>1 day/sec</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="text-2xl font-semibold">
              {formatTime(currentTime)}
            </div>
            <div className="text-sm text-gray-500">
              Elapsed time since pouring
            </div>
          </div>
        </div>
      </div>
      
      {/* Mix Selection and Maturity Method Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="mix-select">
              Concrete Mix Design
            </label>
            <select
              id="mix-select"
              value={selectedMix}
              onChange={(e) => handleMixChange(e.target.value)}
              className="block w-full p-2 border border-gray-300 rounded-md"
            >
              {Object.keys(mixLibrary).map(mixId => (
                <option key={mixId} value={mixId}>
                  {mixLibrary[mixId].name}
                </option>
              ))}
            </select>
            <div className="mt-2 text-sm text-gray-500">
              <div>Cement: {simulationParameters.mix.cement_content} kg/m³</div>
              <div>Water: {simulationParameters.mix.water_content} kg/m³</div>
              <div>Ultimate Strength: {simulationParameters.mix.ultimate_strength} MPa</div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="maturity-method">
              Maturity Calculation Method
            </label>
            <select
              id="maturity-method"
              value={maturityMethod}
              onChange={(e) => setMaturityMethod(e.target.value)}
              className="block w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="nurse-saul">Temperature-Time Factor (Nurse-Saul)</option>
              <option value="equivalent-age">Equivalent Age (Arrhenius)</option>
              <option value="weighted">Weighted Maturity</option>
            </select>
            
            <div className="mt-2">
              {maturityMethod === 'nurse-saul' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700" htmlFor="datum-temp">Datum Temperature:</label>
                  <select
                    id="datum-temp"
                    value={datumTemperature}
                    onChange={(e) => setDatumTemperature(Number(e.target.value))}
                    className="p-1 border border-gray-300 rounded"
                  >
                    <option value="0">0°C</option>
                    <option value="-5">-5°C</option>
                    <option value="-10">-10°C</option>
                  </select>
                </div>
              )}
              
              {maturityMethod === 'equivalent-age' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700" htmlFor="activation-energy">Activation Energy/R:</label>
                  <input
                    id="activation-energy"
                    type="number"
                    value={activationEnergy}
                    onChange={(e) => setActivationEnergy(Number(e.target.value))}
                    className="w-20 p-1 border border-gray-300 rounded"
                  /> K
                </div>
              )}
              
              {maturityMethod === 'weighted' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700" htmlFor="c-value">C-Value:</label>
                  <input
                    id="c-value"
                    type="number"
                    step="0.05"
                    min="1.25"
                    max="1.75"
                    value={cValue}
                    onChange={(e) => setCValue(Number(e.target.value))}
                    className="w-20 p-1 border border-gray-300 rounded"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="mb-2">
            <div className="text-lg font-semibold flex items-center gap-2">
              Temperature
            </div>
          </div>
          <div className="text-3xl font-bold text-red-600">
            {currentValues.coreTemperature.toFixed(1)}°C
          </div>
          <div className="text-sm text-gray-500">Core Temperature</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Ambient: {currentValues.ambientTemperature.toFixed(1)}°C</span>
            <span className="text-sm text-gray-500">Surface: {currentValues.surfaceTemperature.toFixed(1)}°C</span>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="mb-2">
            <div className="text-lg font-semibold flex items-center gap-2">
              Strength
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {currentValues.strength.toFixed(1)} MPa
          </div>
          <div className="text-sm text-gray-500">Compressive Strength</div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${getStrengthPercentage()}%` }}
                aria-label={`${getStrengthPercentage()}% of design strength`}
              ></div>
            </div>
            <div className="text-sm text-gray-500">
              {getStrengthPercentage()}% of design strength
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="mb-2">
            <div className="text-lg font-semibold flex items-center gap-2">
              Humidity & Hydration
            </div>
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {currentValues.humidity.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Internal Humidity</div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div 
                className="bg-purple-600 h-2 rounded-full" 
                style={{ width: `${Math.round(currentValues.hydrationDegree * 100)}%` }}
                aria-label={`${Math.round(currentValues.hydrationDegree * 100)}% hydration complete`}
              ></div>
            </div>
            <div className="text-sm text-gray-500">
              {(currentValues.hydrationDegree * 100).toFixed(1)}% hydration complete
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="mb-2">
            <div className="text-lg font-semibold flex items-center gap-2">
              Risk Factors
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Thermal Gradient:</span>
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ 
                  backgroundColor: getRiskColor(
                    currentValues.thermalGradient > 20 ? 'high' : 
                    currentValues.thermalGradient > 15 ? 'medium' : 'low'
                  )
                }}
              >
                {currentValues.thermalGradient.toFixed(1)}°C
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Thermal Stress:</span>
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ 
                  backgroundColor: getRiskColor(currentValues.crackingRisk)
                }}
              >
                {currentValues.thermalStress.toFixed(1)} MPa
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tensile Strength:</span>
              <span className="text-sm font-medium">
                {currentValues.tensileStrength.toFixed(1)} MPa
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Cracking Risk:</span>
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ 
                  backgroundColor: getRiskColor(currentValues.crackingRisk)
                }}
              >
                {currentValues.crackingRisk.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Milestone Status */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-2">
          <div className="text-lg font-semibold">Curing Milestones</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getMilestoneInfo().map((milestone, index) => (
            <div key={index} className="flex items-center gap-3">
              <div 
                className={`w-4 h-4 rounded-full ${milestone.reached ? 'bg-green-500' : 'bg-gray-300'}`}
                aria-label={milestone.reached ? "Milestone reached" : "Milestone not reached"}
              ></div>
              <div>
                <div className="font-medium">{milestone.name}</div>
                <div className="text-sm text-gray-500">
                  {milestone.reached 
                    ? `Reached at ${formatTime(milestone.time)}` 
                    : `${milestone.threshold.toFixed(1)} MPa required`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Charts */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-4">
          <div className="flex space-x-2 border-b overflow-x-auto">
            <button 
              className={`p-2 whitespace-nowrap ${activeTab === 'temperature' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setActiveTab('temperature')}
            >
              Temperature
            </button>
            <button 
              className={`p-2 whitespace-nowrap ${activeTab === 'strength' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setActiveTab('strength')}
            >
              Strength
            </button>
            <button 
              className={`p-2 whitespace-nowrap ${activeTab === 'humidity' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setActiveTab('humidity')}
            >
              Humidity
            </button>
            <button 
              className={`p-2 whitespace-nowrap ${activeTab === 'risks' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setActiveTab('risks')}
            >
              Risk Factors
            </button>
            <button 
              className={`p-2 whitespace-nowrap ${activeTab === 'roi' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setActiveTab('roi')}
            >
              ROI Calculator
            </button>
            <button 
              className={`p-2 whitespace-nowrap ${activeTab === 'info' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Process Information
            </button>
          </div>
        </div>
        
        {activeTab === 'temperature' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getCurrentDataSlice(temperatureData)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  type="number" 
                  domain={[0, simulationParameters.simulation.duration]}
                  tickFormatter={formatTime}
                />
                <YAxis 
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  formatter={(value) => [`${value.toFixed(1)}°C`, '']}
                  labelFormatter={(value) => `Time: ${formatTime(value)}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="coreTemperature" 
                  name="Core" 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                />
                <Line 
                  type="monotone" 
                  dataKey="surfaceTemperature" 
                  name="Surface" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="ambientTemperature" 
                  name="Ambient" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                />
                <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" label="DEF Risk Level" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {activeTab === 'strength' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={getCurrentDataSlice(strengthData)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  type="number"
                  domain={[0, simulationParameters.simulation.duration]}
                  tickFormatter={formatTime}
                />
                <YAxis 
                  label={{ value: 'Strength (MPa)', angle: -90, position: 'insideLeft' }}
                  domain={[0, simulationParameters.mix.ultimate_strength * 1.1]}
                />
                <Tooltip 
                  formatter={(value) => [`${value.toFixed(1)} MPa`, '']}
                  labelFormatter={(value) => `Time: ${formatTime(value)}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="strength" 
                  name="Compressive Strength" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="tensileStrength" 
                  name="Tensile Strength" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={false}
                />
                <ReferenceLine 
                  y={0.15 * simulationParameters.mix.ultimate_strength} 
                  stroke="#22c55e"
                  strokeDasharray="3 3" 
                  label="Formwork Removal" 
                />
                <ReferenceLine 
                  y={0.75 * simulationParameters.mix.ultimate_strength} 
                  stroke="#f59e0b"
                  strokeDasharray="3 3" 
                  label="Loading Ready" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {activeTab === 'humidity' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getCurrentDataSlice(humidityData)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  type="number"
                  domain={[0, simulationParameters.simulation.duration]}
                  tickFormatter={formatTime}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Hydration Degree', angle: 90, position: 'insideRight' }}
                  domain={[0, 1]}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'internalHumidity') return [`${value.toFixed(1)}%`, 'Internal Humidity'];
                    return [`${(value * 100).toFixed(1)}%`, 'Hydration Degree'];
                  }}
                  labelFormatter={(value) => `Time: ${formatTime(value)}`}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="internalHumidity" 
                  name="Internal Humidity" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="hydrationDegree" 
                  name="Hydration Degree" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                />
                <ReferenceLine yAxisId="left" y={80} stroke="orange" strokeDasharray="3 3" label="Critical Humidity" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {activeTab === 'risks' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={getCurrentDataSlice(riskData)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  type="number"
                  domain={[0, simulationParameters.simulation.duration]}
                  tickFormatter={formatTime}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'Thermal Gradient (°C)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 'auto']}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Stress / Strength (MPa)', angle: 90, position: 'insideRight' }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'thermalGradient') return [`${value.toFixed(1)}°C`, 'Thermal Gradient'];
                    if (name === 'thermalStress') return [`${value.toFixed(1)} MPa`, 'Thermal Stress'];
                    if (name === 'tensileStrength') return [`${value.toFixed(1)} MPa`, 'Tensile Strength'];
                    return [`${(value * 1000).toFixed(0)} g/m²/h`, 'Evaporation Rate'];
                  }}
                  labelFormatter={(value) => `Time: ${formatTime(value)}`}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="thermalGradient" 
                  name="Thermal Gradient" 
                  fill="#f59e0b"
                  barSize={4}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="thermalStress" 
                  name="Thermal Stress" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="tensileStrength" 
                  name="Tensile Strength" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={false}
                />
                <ReferenceLine yAxisId="left" y={20} stroke="red" strokeDasharray="3 3" label="Critical Gradient" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {activeTab === 'roi' && (
          <div>
            <div className="p-2 mb-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-blue-700">
                This calculator helps you estimate the potential savings and return on investment when using the maturity method instead of conventional break tests.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Project Parameters</h3>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-1" htmlFor="project-volume">Total Concrete Volume (m³)</label>
                  <input 
                    id="project-volume"
                    type="number" 
                    value={projectVolume} 
                    onChange={(e) => setProjectVolume(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-1" htmlFor="num-pours">Number of Pours</label>
                  <input 
                    id="num-pours"
                    type="number" 
                    value={numberOfPours} 
                    onChange={(e) => setNumberOfPours(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-1" htmlFor="test-cost">Average Cost per Break Test ($/pour)</label>
                  <input 
                    id="test-cost"
                    type="number" 
                    value={averageTestCost} 
                    onChange={(e) => setAverageTestCost(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-1" htmlFor="delay-days">Project Delay Days (using cylinders)</label>
                  <input 
                    id="delay-days"
                    type="number" 
                    value={delayDays} 
                    onChange={(e) => setDelayDays(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-1" htmlFor="daily-cost">Daily Project Cost ($/day)</label>
                  <input 
                    id="daily-cost"
                    type="number" 
                    value={dailyCost} 
                    onChange={(e) => setDailyCost(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-4">ROI Analysis</h3>
                
                {(() => {
                  const roi = calculateROI();
                  return (
                    <div className="space-y-4">
                      <div className="bg-gray-100 p-4 rounded">
                        <h4 className="font-medium mb-2">Maturity Method Costs</h4>
                        <div className="flex justify-between">
                          <span>Sensor Cost ($2/m³):</span>
                          <span>${(projectVolume * 2).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Calibration Cost:</span>
                          <span>$2,000</span>
                        </div>
                        <div className="flex justify-between font-medium mt-2">
                          <span>Total Cost:</span>
                          <span>${roi.maturityCost.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="bg-gray-100 p-4 rounded">
                        <h4 className="font-medium mb-2">Savings</h4>
                        <div className="flex justify-between">
                          <span>Break Test Savings:</span>
                          <span>${roi.breakTestCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Project Delay Savings:</span>
                          <span>${roi.delayCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-medium mt-2">
                          <span>Total Savings:</span>
                          <span>${roi.totalSavings.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 p-4 border-l-4 border-green-500 rounded">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Net Savings:</span>
                          <span>${roi.netSavings.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Return on Investment:</span>
                          <span>{roi.roi.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-lg mb-2">Maturity Methods Explained</h3>
              <div className="space-y-3 text-sm">
                <p>
                  <strong>1. Temperature-Time Factor (Nurse-Saul Method):</strong> This is the most common method used in North America due to its simplicity. It assumes a linear relationship between temperature and strength development rate. The formula is:
                </p>
                <div className="bg-gray-100 p-2 rounded">
                  M = Σ((T - T₀) × Δt)
                </div>
                <p>
                  Where T is the average concrete temperature during time interval Δt, and T₀ is the datum temperature (typically 0°C, -5°C, or -10°C). The datum temperature is the temperature below which hydration is assumed to stop.
                </p>
                
                <p>
                  <strong>2. Equivalent Age Method (Arrhenius):</strong> This method uses the Arrhenius equation to account for the non-linear effect of temperature on hydration rate. It's more accurate for wider temperature ranges:
                </p>
                <div className="bg-gray-100 p-2 rounded">
                  tₑ = Σ(e^(-E/R×(1/T - 1/Tᵣ)) × Δt)
                </div>
                <p>
                  Where E is activation energy, R is the gas constant, T is the concrete temperature, and Tᵣ is the reference temperature (usually 23°C).
                </p>
                
                <p>
                  <strong>3. Weighted Maturity Method:</strong> This method, developed in Europe, accounts for different cement types and their sensitivity to temperature:
                </p>
                <div className="bg-gray-100 p-2 rounded">
                  Mw = Σ(10(C^n - C^-1.245)/ln(C) × Δt)
                </div>
                <p>
                  Where C is the C-value of cement (typically 1.25-1.75) and n is a temperature-dependent parameter (0.1T-1.245).
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg mb-2">Key Variables Explained</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium">Concrete Properties</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Ultimate Strength:</strong> The maximum strength a concrete mix is expected to reach at full maturity</li>
                    <li><strong>Water-Cement Ratio:</strong> Affects strength, workability, and durability</li>
                    <li><strong>Cement Content:</strong> Higher cement content generally leads to higher early strength gain and more heat generation</li>
                    <li><strong>Tensile Strength:</strong> Typically about 10% of compressive strength, important for thermal crack resistance</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium">Risk Factors</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Thermal Gradient:</strong> Temperature difference between core and surface, critical for crack prevention</li>
                    <li><strong>Thermal Stress:</strong> Calculated from thermal gradient, elasticity, thermal expansion, and restraint</li>
                    <li><strong>Evaporation Rate:</strong> Affects plastic shrinkage cracking risk in fresh concrete</li>
                    <li><strong>Cracking Risk:</strong> Assessed by comparing thermal stress to tensile strength</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg mb-2">Practical Application Tips</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>1. Sensor Placement:</strong> Install sensors at critical locations: the coldest parts (e.g., edges, corners), structurally critical sections (slab-column connections, mid-spans), and at the end of the pour sequence.
                </p>
                <p>
                  <strong>2. Critical Operations:</strong> Common thresholds include:
                </p>
                <ul className="list-disc pl-8">
                  <li>Formwork removal: ≥ 15% of design strength</li>
                  <li>Post-tensioning: ≥ 75% of design strength</li>
                  <li>Full loading: 100% of design strength</li>
                </ul>
                <p>
                  <strong>3. Validation:</strong> Regularly compare maturity predictions with break tests to ensure calibration accuracy. Recalibrate if variations exceed 10%.
                </p>
                <p>
                  <strong>4. Safety Factor:</strong> For critical applications, include a safety factor in your maturity-strength relationship or require a higher threshold strength before proceeding.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Simulation Speed Presets */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-2">
          <div className="text-lg font-semibold">Simulation Speed Presets</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            className={`px-3 py-2 rounded text-sm ${simulationSpeed === 60 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setSimulationSpeed(60)}
          >
            1 hour/sec
          </button>
          <button 
            className={`px-3 py-2 rounded text-sm ${simulationSpeed === 180 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setSimulationSpeed(180)}
          >
            3 hours/sec
          </button>
          <button 
            className={`px-3 py-2 rounded text-sm ${simulationSpeed === 360 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setSimulationSpeed(360)}
          >
            6 hours/sec
          </button>
          <button 
            className={`px-3 py-2 rounded text-sm ${simulationSpeed === 720 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setSimulationSpeed(720)}
          >
            12 hours/sec
          </button>
          <button 
            className={`px-3 py-2 rounded text-sm ${simulationSpeed === 1440 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setSimulationSpeed(1440)}
          >
            1 day/sec
          </button>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="mt-4 text-sm text-center text-gray-500">
        Concrete Curing Digital Twin | Advanced Maturity-Based Simulation
      </footer>
    </div>
  );
};

export default ConcreteCuringDashboard;
