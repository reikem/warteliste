import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Animated, Easing, Dimensions } from 'react-native';
import { LayoutGrid, Megaphone, Settings, Users, Monitor, Play, Pause, Gift, Award, Zap } from 'lucide-react-native';
import { NowServingCard } from '@/components/ui/nowServingCard';
import { Ticket, RecentTurnsList } from '@/components/ui/recentTurnsList';
import { WeatherState, WeatherWidget } from '@/components/ui/weatherWidget';

// Importación de componentes locales reutilizables


const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MonitorScreen() {
  // --- Estados del Sistema ---
  const [currentTicket, setCurrentTicket] = useState<Ticket>({ id: '1', number: 'A-124', desk: 'Desk 4' });
  const [recentTurns, setRecentTurns] = useState<Ticket[]>([
    { id: 'h1', number: 'A-123', desk: 'Desk 1' },
    { id: 'h2', number: 'C-014', desk: 'Desk 3' },
    { id: 'h3', number: 'A-122', desk: 'Desk 2' },
    { id: 'h4', number: 'B-205', desk: 'Desk 4' },
  ]);
  const [ticketCounter, setTicketCounter] = useState<number>(124);
  const [currentTime, setCurrentTime] = useState<string>('12:45 PM');
  const [activeTab, setActiveTab] = useState<string>('Monitor');
  
  const [weather, setWeather] = useState<WeatherState>({
    isSunny: true,
    desc: 'Sunny & Bright',
    temp: '72°F',
    high: 'H: 78°',
    low: 'L: 64°'
  });

  // --- Referencias de Animación ---
  const marqueeAnim = useRef(new Animated.Value(0)).current;
  const bellScale = useRef(new Animated.Value(1)).current;
  const ticketOpacity = useRef(new Animated.Value(1)).current;
  
  // --- Estado del Carrusel de Ofertas ---
  const [isCarouselPlaying, setIsCarouselPlaying] = useState<boolean>(true);
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const carouselOffers = [
    { id: 1, title: 'Seasonal Rewards', desc: 'Check your app for exclusive holiday points!', icon: <Gift size={32} color="#00685f" /> },
    { id: 2, title: 'Premium Upgrade', desc: 'Upgrade today for faster service and lounge access.', icon: <Award size={32} color="#00685f" /> },
    { id: 3, title: 'EV Charging', desc: 'Free charging available for all premium members.', icon: <Zap size={32} color="#00685f" /> },
  ];

  // Ciclo de reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animación Loop de la cinta informativa inferior
  useEffect(() => {
    marqueeAnim.setValue(0);
    Animated.loop(
      Animated.timing(marqueeAnim, {
        toValue: -SCREEN_WIDTH,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [marqueeAnim]);

  // Autoplay del bloque multimedia
  useEffect(() => {
    let autoplayTimer: NodeJS.Timeout;
    if (isCarouselPlaying) {
      autoplayTimer = setInterval(() => {
        setCarouselIndex((prev) => (prev + 1) % carouselOffers.length);
      }, 4000);
    }
    return () => clearInterval(autoplayTimer);
  }, [isCarouselPlaying]);

  // Interacción: Simular paso de turnos
  const handleNextTurn = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(ticketOpacity, { toValue: 0.3, duration: 120, useNativeDriver: true }),
        Animated.timing(bellScale, { toValue: 1.25, duration: 120, useNativeDriver: true })
      ]),
      Animated.parallel([
        Animated.timing(ticketOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(bellScale, { toValue: 1, duration: 180, useNativeDriver: true })
      ])
    ]).start();

    const nextCount = ticketCounter + 1;
    const prefixes = ['A', 'B', 'C'];
    const newNum = `${prefixes[Math.floor(Math.random() * 3)]}-${nextCount}`;
    const newDesk = `Desk ${Math.floor(Math.random() * 5) + 1}`;

    setRecentTurns(prev => [{ id: Date.now().toString(), number: currentTicket.number, desk: currentTicket.desk }, ...prev.slice(0, 3)]);
    setTicketCounter(nextCount);
    setCurrentTicket({ id: Date.now().toString(), number: newNum, desk: newDesk });
  };

  // Interacción: Cambiar clima simulado
  const handleToggleWeather = () => {
    setWeather(prev => prev.isSunny ? {
      isSunny: false,
      desc: 'Cloudy & Rain',
      temp: '58°F',
      high: 'H: 62°',
      low: 'L: 52°'
    } : {
      isSunny: true,
      desc: 'Sunny & Bright',
      temp: '72°F',
      high: 'H: 78°',
      low: 'L: 64°'
    });
  };

  return (
    <View className="flex-1 bg-[#f8f9ff]">
      
      {/* HEADER */}
      <View className="w-full bg-white border-b border-[#bcc9c6] px-4 py-4 flex-row justify-between items-center">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={handleNextTurn} activeOpacity={0.8} className="w-10 h-10 bg-[#00685f] rounded-lg items-center justify-center shadow-sm">
            <LayoutGrid size={22} color="#ffffff" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-[#00685f] font-[HankenGrotesk]">QueueMaster Pro</Text>
            <Text className="text-[13px] font-semibold text-[#3d4947] tracking-wider uppercase font-[Inter]">Lobby View • Floor 1</Text>
          </View>
        </View>
        <View className="w-10 h-10 rounded-full bg-[#dae2fd] border border-[#bcc9c6] overflow-hidden">
          <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASnnIeGXL4R8MCFOXxBKMSxX5VYz5AyHjLJKpT_j1NQtegXJRIL_YXGo_aLTwynMrTQlHcG853K3D80pELkvNyrSh49J4p4OSc7Xc5tZ1KXqHqu5j97sYKTbhkgzBhmEaAEALe_KhxDKtNklxm4yu01tmWtD0Ntp-j7HLREYRjjzgPAVy95w1MFiWiKi1XTrxfByLR2eHeTinoIoOpGC81qp-1awjBH8R6qkDdCqsWjbG9WQ0rQjHR_NbritnLuvtoaR-GymPZt30r' }} className="w-full h-full object-cover" />
        </View>
      </View>

      {/* CONTENIDO SCROLLABLE */}
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} className="flex-1 p-4 gap-4" showsVerticalScrollIndicator={false}>
        
        {/* Componente Reutilizable 1: Turno Actual */}
        <NowServingCard 
          ticketNumber={currentTicket.number} 
          deskNumber={currentTicket.desk} 
          bellScale={bellScale} 
          ticketOpacity={ticketOpacity} 
        />

        {/* Componente Reutilizable 2: Clima */}
        <WeatherWidget data={weather} onPress={handleToggleWeather} />

        {/* Bloque Multimedia / Ofertas */}
        <View className="w-full min-h-[200px] bg-[#eff4ff] border border-[#bcc9c6] rounded-lg overflow-hidden">
          <View className="p-3 px-4 bg-[#f8f9ff] border-b border-[#bcc9c6] flex-row justify-between items-center">
            <Text className="text-[13px] font-bold text-[#3d4947] uppercase tracking-widest font-[Inter]">Multimedia & Offers</Text>
            <TouchableOpacity onPress={() => setIsCarouselPlaying(!isCarouselPlaying)} className="p-1 rounded bg-[#d3e4fe]">
              {isCarouselPlaying ? <Pause size={18} color="#00685f" /> : <Play size={18} color="#00685f" />}
            </TouchableOpacity>
          </View>
          <View className="flex-1 items-center justify-center p-6 min-h-[140px]">
            <View className="w-full items-center">
              <View className="mb-2 bg-white p-3 rounded-full shadow-sm">{carouselOffers[carouselIndex].icon}</View>
              <Text className="text-lg font-bold text-[#00685f] mb-1 font-[HankenGrotesk]">{carouselOffers[carouselIndex].title}</Text>
              <Text className="text-xs text-[#3d4947] text-center max-w-[85%] font-[Inter]">{carouselOffers[carouselIndex].desc}</Text>
            </View>
            <View className="flex-row gap-1.5 mt-4">
              {carouselOffers.map((_, idx) => (
                <View key={idx} className={`w-2 h-2 rounded-full ${idx === carouselIndex ? 'bg-[#00685f] w-4' : 'bg-[#bcc9c6]'}`} />
              ))}
            </View>
          </View>
        </View>

        {/* Componente Reutilizable 3: Historial de Turnos */}
        <RecentTurnsList turns={recentTurns} />

      </ScrollView>

      {/* MARQUEE INFORMATIVO INFERIOR */}
      <View className="absolute bottom-14 left-0 right-0 bg-[#213145] py-2.5 flex-row items-center overflow-hidden">
        <Animated.View style={{ transform: [{ translateX: marqueeAnim }] }} className="flex-row gap-8">
          <Text className="text-[13px] text-[#eaf1ff] font-bold uppercase tracking-wider font-[Inter]">
            Estimated wait time is 12 minutes. Please have your ID ready.  •  Join our loyalty program for prioritized queuing.
          </Text>
        </Animated.View>
        <View className="absolute right-0 top-0 bottom-0 bg-[#213145] flex-row items-center px-4 gap-3 border-l border-white/10">
          <Text className="text-[13px] text-[#eaf1ff] font-medium font-[Inter]">{currentTime}</Text>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-full bg-[#6bd8cb]" />
            <Text className="text-[11px] font-bold text-[#eaf1ff] uppercase font-[Inter] opacity-80">Live</Text>
          </View>
        </View>
      </View>

      {/* BOTTOM TAB BAR */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#bcc9c6] flex-row justify-around items-center h-14 px-2">
        {['Setup', 'Queue', 'Kiosk', 'Monitor'].map((tab) => (
          <TouchableOpacity 
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-col items-center justify-center px-4 py-1 rounded-full ${activeTab === tab ? 'bg-[#008378] px-6' : 'opacity-60'}`}
          >
            <Settings size={20} color={activeTab === tab ? '#f4fffc' : '#3d4947'} />
            <Text className={`text-[9px] uppercase font-bold mt-0.5 ${activeTab === tab ? 'text-[#f4fffc]' : 'text-[#3d4947]'}`}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
}