import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, SafeAreaView, Alert } from 'react-native';
import { Ticket, User, Mail, BellRing, ArrowLeft, CheckCircle2, Home, Scan, HelpCircle } from 'lucide-react-native';
import { KioskInput } from '@/components/ui/kioskInput';

// Componentes Reutilizables locales


export default function KioskScreen() {
  // --- Estados de Formulario y Enfoque ---
  const [fullName, setFullName] = useState<string>('');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [activeInput, setActiveInput] = useState<'name' | 'contact'>('name');
  const [activeTab, setActiveTab] = useState<string>('Inicio');

  // --- Manejo del Teclado en Pantalla ---
  const handleKeyPress = (key: string) => {
    if (activeInput === 'name') {
      setFullName((prev) => prev + key);
    } else {
      setContactInfo((prev) => prev + key.toLowerCase());
    }
  };

  const handleDelete = () => {
    if (activeInput === 'name') {
      setFullName((prev) => prev.slice(0, -1));
    } else {
      setContactInfo((prev) => prev.slice(0, -1));
    }
  };

  const handleSpace = () => {
    if (activeInput === 'name') {
      setFullName((prev) => prev + ' ');
    } else {
      setContactInfo((prev) => prev + ' ');
    }
  };

  const handleRegister = () => {
    if (!fullName.trim() || !contactInfo.trim()) {
      Alert.alert('Campos incompletos', 'Por favor llena toda la información antes de continuar.');
      return;
    }
    Alert.alert('¡Registro Exitoso!', `Gracias ${fullName}, te avisaremos cuando tu turno esté listo.`);
    setFullName('');
    setContactInfo('');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f8f9ff]">
      
      {/* TOP APP BAR */}
      <View className="w-full h-16 bg-white border-b border-[#bcc9c6] px-6 flex-row items-center justify-between z-40">
        <View className="flex-row items-center gap-2">
          <Ticket size={24} color="#00685f" />
          <Text className="text-xl font-bold text-[#00685f] font-[HankenGrotesk]">
            QueueMaster Pro
          </Text>
        </View>
        <View className="w-10 h-10 rounded-full bg-[#d3e4fe] border border-[#bcc9c6] overflow-hidden">
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqBRonMVBwsqPHzka1Y0LctXQis678sramQrIwFw_lQpRSmM7WisHZLEHTAuKzzy2IZAxgCn1ciOIH2szMKpSBVpEM_58rcFGg-_bwqHHyQw7WKN7xmWt3TyYNQZp21XUMq8NKPp1F5jm85_XXljQ4MxvRIxo_1y8O-CDnP18hO3mNwTp6hMDVZXYqWvvsQCk7lqkNlJlk7xQAbyFwEOS-a2_bP6zm2vEp7MIiwp-xIlsCB819KaYG_AB2ze77AMRZC8_RPhSHqbI1' }} 
            className="w-full h-full object-cover" 
          />
        </View>
      </View>

      {/* CONTENIDO PRINCIPAL */}
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 120, alignItems: 'center' }} 
        className="flex-1 p-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="max-w-xl w-full gap-6 mt-2">
          
          {/* Header del Formulario */}
          <View className="items-center gap-1.5 text-center">
            <Text className="text-2xl font-bold text-[#0b1c30] font-[HankenGrotesk]">
              Ingresa tus datos
            </Text>
            <Text className="text-sm text-[#3d4947] text-center px-4 font-[Inter] leading-5">
              Por favor, completa la información para registrarte en la cola. Te notificaremos cuando un asesor esté disponible.
            </Text>
          </View>

          {/* Tarjeta de Formulario */}
          <View className="w-full bg-white border border-[#bcc9c6] rounded-xl p-5 gap-4 shadow-sm">
            
            {/* Input: Nombre */}
            <KioskInput 
              label="Nombre Completo"
              value={fullName}
              placeholder="Ej. Juan Pérez"
              icon={<User size={22} color="#3d4947" />}
              isFocused={activeInput === 'name'}
              onPress={() => setActiveInput('name')}
            />

            {/* Input: Contacto */}
            <KioskInput 
              label="Teléfono o Correo Electrónico"
              value={contactInfo}
              placeholder="Ej. +52 555 123 4567 o juan@ejemplo.com"
              icon={<Mail size={22} color="#3d4947" />}
              isFocused={activeInput === 'contact'}
              onPress={() => setActiveInput('contact')}
            />

            {/* Nota Informativa */}
            <View className="bg-[#e5eeff] rounded-lg p-3.5 flex-row items-start gap-3 border border-[#bcc9c6]/30">
              <View className="mt-0.5">
                <BellRing size={18} color="#00685f" />
              </View>
              <Text className="flex-1 text-xs text-[#3d4947] font-[Inter] leading-4">
                <Text className="font-bold">Notificación instantánea:</Text> Recibirás un SMS o correo electrónico en cuanto tu turno sea el siguiente. No es necesario permanecer en la zona de espera.
              </Text>
            </View>
          </View>

          {/* Teclado Virtual */}
          <VirtualKeyboard 
            onKeyPress={handleKeyPress} 
            onDelete={handleDelete} 
            onSpace={handleSpace} 
          />

          {/* Botones de Acción */}
          <View className="flex-row gap-4 mt-2">
            <TouchableOpacity 
              className="flex-1 h-16 bg-[#d3e4fe] border border-[#bcc9c6] rounded-xl flex-row items-center justify-center gap-2 active:scale-95"
              onPress={() => {
                setFullName('');
                setContactInfo('');
              }}
            >
              <ArrowLeft size={20} color="#3d4947" />
              <Text className="text-base font-semibold text-[#3d4947] font-[Inter]">Regresar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleRegister}
              className="flex-[2] h-16 bg-[#00685f] rounded-xl flex-row items-center justify-center gap-2 active:scale-95 shadow-sm"
            >
              <Text className="text-base font-bold text-white font-[Inter]">Confirmar Registro</Text>
              <CheckCircle2 size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* BOTTOM NAV BAR */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#bcc9c6] flex-row justify-around items-center h-16 pb-2 px-4 shadow-lg">
        {[
          { name: 'Inicio', icon: <Home size={22} color={activeTab === 'Inicio' ? '#f4fffc' : '#3d4947'} /> },
          { name: 'Escanear', icon: <Scan size={22} color={activeTab === 'Escanear' ? '#f4fffc' : '#3d4947'} /> },
          { name: 'Ayuda', icon: <HelpCircle size={22} color={activeTab === 'Ayuda' ? '#f4fffc' : '#3d4947'} /> }
        ].map((tab) => (
          <TouchableOpacity 
            key={tab.name}
            onPress={() => setActiveTab(tab.name)}
            className={`flex-col items-center justify-center px-6 py-1 rounded-full ${
              activeTab === tab.name ? 'bg-[#008378] px-8' : 'opacity-80'
            }`}
          >
            {tab.icon}
            <Text className={`text-[10px] font-bold mt-0.5 uppercase ${
              activeTab === tab.name ? 'text-[#f4fffc]' : 'text-[#3d4947]'
            }`}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

    </SafeAreaView>
  );
}