import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { database } from './firebase';
import { ref, onValue, set, get } from 'firebase/database';

export default function SmartParkingScreen() {
  const [parkingData, setParkingData] = useState({
    cars: [
      { id: 1, occupied: false, sensor: 'IR1', booking: null },
      { id: 2, occupied: false, sensor: 'IR2', booking: null },
      { id: 3, occupied: false, sensor: 'IR3', booking: null }
    ],
    bikes: [
      { id: 1, occupied: false, sensor: 'IR4', booking: null },
      { id: 2, occupied: false, sensor: 'IR5', booking: null },
      { id: 3, occupied: false, sensor: 'IR6', booking: null }
    ],
    heavyVehicles: [
      { id: 1, occupied: false, sensor: 'IR7', booking: null },
      { id: 2, occupied: false, sensor: 'IR8', booking: null },
      { id: 3, occupied: false, sensor: 'IR9', booking: null }
    ]
  });

  const [summary, setSummary] = useState({
    car_occupied: 0,
    bike_occupied: 0,
    heavy_occupied: 0,
    car_total: 3,
    bike_total: 3,
    heavy_total: 3
  });

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    vehicleType: 'cars',
    spotId: null,
    userName: '',
    vehicleNumber: '',
    duration: '1'
  });

  // Listen to Firebase real-time updates from ESP32
  useEffect(() => {
    const smartParkingRef = ref(database, 'SmartParking');
    
    const unsubscribe = onValue(smartParkingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setConnected(true);
        
        // Update cars
        if (data.cars) {
          const updatedCars = parkingData.cars.map((car, index) => ({
            ...car,
            occupied: data.cars[index + 1]?.occupied || false,
            sensor: data.cars[index + 1]?.sensor || `IR${index + 1}`
          }));
          
          // Update bikes
          const updatedBikes = parkingData.bikes.map((bike, index) => ({
            ...bike,
            occupied: data.bikes[index + 1]?.occupied || false,
            sensor: data.bikes[index + 1]?.sensor || `IR${index + 4}`
          }));
          
          // Update heavy vehicles
          const updatedHeavy = parkingData.heavyVehicles.map((heavy, index) => ({
            ...heavy,
            occupied: data.heavyVehicles[index + 1]?.occupied || false,
            sensor: data.heavyVehicles[index + 1]?.sensor || `IR${index + 7}`
          }));

          setParkingData({
            cars: updatedCars,
            bikes: updatedBikes,
            heavyVehicles: updatedHeavy
          });
        }

        // Update summary
        if (data.summary) {
          setSummary(data.summary);
        }
        
        setLoading(false);
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setConnected(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getAvailableCount = (type) => {
    return parkingData[type].filter(spot => !spot.occupied && !spot.booking).length;
  };

  const handleBooking = async (type, spotId) => {
    // Check if spot is occupied from ESP32
    const spotData = parkingData[type].find(s => s.id === spotId);
    if (spotData.occupied) {
      Alert.alert('Error', 'This spot is currently occupied!');
      return;
    }
    
    setBookingForm({ vehicleType: type, spotId, userName: '', vehicleNumber: '', duration: '1' });
    setShowBookingModal(true);
  };

  const submitBooking = async () => {
    if (!bookingForm.userName || !bookingForm.vehicleNumber) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const booking = {
      userName: bookingForm.userName,
      vehicleNumber: bookingForm.vehicleNumber,
      duration: bookingForm.duration,
      bookingTime: new Date().toISOString(),
      expiryTime: new Date(Date.now() + parseInt(bookingForm.duration) * 60 * 60 * 1000).toISOString()
    };

    try {
      // Save booking to Firebase
      const bookingPath = `SmartParking/${bookingForm.vehicleType}/${bookingForm.spotId}/booking`;
      await set(ref(database, bookingPath), booking);

      // Update local state
      setParkingData(prev => {
        const newData = { ...prev };
        const spot = newData[bookingForm.vehicleType].find(s => s.id === bookingForm.spotId);
        if (spot) {
          spot.booking = booking;
        }
        return newData;
      });

      setShowBookingModal(false);
      Alert.alert('Success', `Parking spot ${bookingForm.spotId} booked successfully!`);
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('Error', 'Failed to book parking spot');
    }
  };

  const cancelBooking = async (type, spotId) => {
    try {
      const bookingPath = `SmartParking/${type}/${spotId}/booking`;
      await set(ref(database, bookingPath), null);

      setParkingData(prev => {
        const newData = { ...prev };
        const spot = newData[type].find(s => s.id === spotId);
        if (spot) spot.booking = null;
        return newData;
      });

      Alert.alert('Success', 'Booking cancelled successfully!');
    } catch (error) {
      console.error('Cancel error:', error);
      Alert.alert('Error', 'Failed to cancel booking');
    }
  };

  const ParkingSpot = ({ spot, type }) => {
    const isAvailable = !spot.occupied && !spot.booking;
    const isBooked = spot.booking !== null;
    const bgColor = spot.occupied ? '#FEE2E2' : isBooked ? '#FEF3C7' : '#D1FAE5';
    const borderColor = spot.occupied ? '#EF4444' : isBooked ? '#F59E0B' : '#10B981';

    return (
      <View style={[styles.spotCard, { backgroundColor: bgColor, borderColor }]}>
        <View style={styles.spotHeader}>
          <Text style={styles.spotText}>
            {type === 'cars' ? '🚗 Car' : type === 'bikes' ? '🏍️ Bike' : '🚚 Heavy'} {spot.id}
          </Text>
          <Text style={styles.statusBadge}>
            {spot.occupied ? '❌ OCCUPIED' : isBooked ? '🕐 BOOKED' : '✅ AVAILABLE'}
          </Text>
        </View>
        <Text style={styles.sensorText}>📡 Sensor: {spot.sensor}</Text>
        {isBooked && spot.booking && (
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingText}>👤 {spot.booking.userName}</Text>
            <Text style={styles.bookingText}>🚗 {spot.booking.vehicleNumber}</Text>
            <Text style={styles.bookingText}>⏱️ {spot.booking.duration}h</Text>
          </View>
        )}
        {isAvailable && (
          <TouchableOpacity style={styles.bookButton} onPress={() => handleBooking(type, spot.id)}>
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        )}
        {isBooked && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => cancelBooking(type, spot.id)}>
            <Text style={styles.cancelButtonText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const OverviewCard = ({ title, icon, available, total, color }) => (
    <View style={[styles.overviewCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={styles.cardStats}>
          <Text style={styles.cardCount}>{available}/{total}</Text>
          <Text style={styles.cardLabel}>Available</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(available/total)*100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Connecting to Firebase...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🅿️ Smart Parking System</Text>
        <Text style={styles.headerSubtitle}>ESP32 + Firebase Real-time</Text>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: connected ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.statusText}>{connected ? 'ESP32 Connected' : 'Disconnected'}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]} 
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'details' && styles.activeTab]} 
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>Parking Spots</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' ? (
          <View style={styles.overviewContainer}>
            <OverviewCard 
              title="Car Parking" 
              icon="🚗" 
              available={getAvailableCount('cars')} 
              total={summary.car_total} 
              color="#3B82F6" 
            />
            <OverviewCard 
              title="Bike Parking" 
              icon="🏍️" 
              available={getAvailableCount('bikes')} 
              total={summary.bike_total} 
              color="#10B981" 
            />
            <OverviewCard 
              title="Heavy Vehicles" 
              icon="🚚" 
              available={getAvailableCount('heavyVehicles')} 
              total={summary.heavy_total} 
              color="#F59E0B" 
            />
            
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>📡 System Status</Text>
              <Text style={styles.infoText}>✅ 9 IR Sensors: IR1-IR9</Text>
              <Text style={styles.infoText}>✅ ESP32 Connected: {connected ? 'YES' : 'NO'}</Text>
              <Text style={styles.infoText}>✅ Firebase: Real-time Sync</Text>
              <Text style={styles.infoText}>✅ WiFi: M0N1</Text>
              <View style={styles.liveStats}>
                <Text style={styles.liveStatsTitle}>Live Occupancy:</Text>
                <Text style={styles.liveStatsText}>🚗 Cars: {summary.car_occupied}/{summary.car_total}</Text>
                <Text style={styles.liveStatsText}>🏍️ Bikes: {summary.bike_occupied}/{summary.bike_total}</Text>
                <Text style={styles.liveStatsText}>🚚 Heavy: {summary.heavy_occupied}/{summary.heavy_total}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.detailsContainer}>
            <Text style={styles.sectionTitle}>🚗 Car Parking (IR1-IR3)</Text>
            {parkingData.cars.map(spot => <ParkingSpot key={spot.id} spot={spot} type="cars" />)}
            
            <Text style={styles.sectionTitle}>🏍️ Bike Parking (IR4-IR6)</Text>
            {parkingData.bikes.map(spot => <ParkingSpot key={spot.id} spot={spot} type="bikes" />)}
            
            <Text style={styles.sectionTitle}>🚚 Heavy Vehicles (IR7-IR9)</Text>
            {parkingData.heavyVehicles.map(spot => <ParkingSpot key={spot.id} spot={spot} type="heavyVehicles" />)}
          </View>
        )}
      </ScrollView>

      <Modal visible={showBookingModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📝 Book Parking Spot</Text>
            <TextInput
              style={styles.input}
              placeholder="Your Name"
              value={bookingForm.userName}
              onChangeText={(text) => setBookingForm({...bookingForm, userName: text})}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Number (TN00XX0000)"
              value={bookingForm.vehicleNumber}
              onChangeText={(text) => setBookingForm({...bookingForm, vehicleNumber: text})}
              autoCapitalize="characters"
            />
            <Text style={styles.inputLabel}>Duration (hours)</Text>
            <View style={styles.durationContainer}>
              {['1','2','3','4','8','24'].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationButton, bookingForm.duration === d && styles.durationActive]}
                  onPress={() => setBookingForm({...bookingForm, duration: d})}
                >
                  <Text style={[styles.durationText, bookingForm.duration === d && styles.durationTextActive]}>{d}h</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBookingModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={submitBooking}>
                <Text style={styles.modalConfirmText}>Confirm Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
  header: { backgroundColor: '#2563EB', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 13, color: '#BFDBFE', marginTop: 4 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, color: 'white', fontWeight: '500' },
  tabs: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#2563EB' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeTabText: { color: '#2563EB', fontWeight: 'bold' },
  content: { flex: 1 },
  overviewContainer: { padding: 16 },
  overviewCard: { backgroundColor: 'white', borderRadius: 8, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardIcon: { fontSize: 32 },
  cardStats: { alignItems: 'flex-end' },
  cardCount: { fontSize: 24, fontWeight: 'bold' },
  cardLabel: { fontSize: 12, color: '#6B7280' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%' },
  infoCard: { backgroundColor: 'white', borderRadius: 8, padding: 16, elevation: 2 },
  infoTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#6B7280', marginVertical: 2 },
  liveStats: { marginTop: 12, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 6 },
  liveStatsTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  liveStatsText: { fontSize: 13, color: '#374151', marginVertical: 2 },
  detailsContainer: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 12 },
  spotCard: { borderRadius: 8, padding: 16, borderWidth: 2, marginBottom: 12 },
  spotHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  spotText: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { fontSize: 11, fontWeight: 'bold' },
  sensorText: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  bookingInfo: { backgroundColor: 'white', padding: 10, borderRadius: 6, marginBottom: 8 },
  bookingText: { fontSize: 13, marginVertical: 1 },
  bookButton: { backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  bookButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#EF4444', padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  durationContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  durationButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  durationActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  durationText: { fontSize: 14, color: '#374151' },
  durationTextActive: { color: 'white', fontWeight: 'bold' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, backgroundColor: '#E5E7EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  modalConfirmBtn: { flex: 1, backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalConfirmText: { fontSize: 16, fontWeight: '600', color: 'white' },
});