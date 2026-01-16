import { useEffect, useMemo, useState } from "react";
import { Package, ShoppingCart, Check, Calendar, Clock, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getWeeklySlotAvailability, userListCustomPackages, userRegisterPurchaseIntent, type CustomPackageRow } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";

interface PackageOption {
  id: number;
  sessions: number;
  price: number;
}

interface CustomPackageOption {
  id: number;
  sessions: number;
  title: string;
  pricePerSession: number;
  totalPrice: number;
  paymentUrl: string;
}

interface TimeSlotSelection {
  dayId: string;
  time: string;
}

const packages: PackageOption[] = [
  { id: 1, sessions: 3, price: 280 },
  { id: 2, sessions: 6, price: 480 },
  { id: 3, sessions: 9, price: 560 },
  { id: 4, sessions: 15, price: 880 },
  { id: 5, sessions: 20, price: 1100 },
  { id: 6, sessions: 35, price: 1750 },
  { id: 7, sessions: 45, price: 2115 },
];

const weekDays = [
  { id: "monday", label: "Segunda-feira", shortLabel: "Seg" },
  { id: "tuesday", label: "Terça-feira", shortLabel: "Ter" },
  { id: "wednesday", label: "Quarta-feira", shortLabel: "Qua" },
  { id: "thursday", label: "Quinta-feira", shortLabel: "Qui" },
  { id: "friday", label: "Sexta-feira", shortLabel: "Sex" },
];

const availableTimes = [
  "08:00", "09:00", "09:40", "10:20", "11:00", "11:40",
  "13:00", "13:40", "14:20", "15:00", "15:40", "16:20",
  "17:00", "17:40", "18:20", "19:00", "19:40", "20:20"
];

const formatPrice = (price: number) => {
  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const getPricePerSession = (sessions: number, price: number) => {
  return (price / sessions).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const PatientPackages = () => {
  const auth = useAuth();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlotSelection[]>([]);
  const [openDays, setOpenDays] = useState<string[]>([]);
  const [unavailableByDay, setUnavailableByDay] = useState<Record<string, string[]>>({});
  const [customPackages, setCustomPackages] = useState<CustomPackageOption[]>([]);

  const paymentLinks: Record<number, string> = {
    3: "https://mpago.li/2nyHQAi",
    6: "https://mpago.li/1j7Xk5U",
    9: "https://mpago.li/2Fof5SU",
    15: "https://mpago.li/32tdG89",
    20: "https://mpago.li/1as3z5h",
    35: "https://mpago.la/143JtGF",
    45: "https://mpago.la/31AJ9th",
  };

  const handleBuyClick = (pkg: PackageOption) => {
    setSelectedPackage(pkg);
    setSelectedSlots([]);
    setOpenDays([]);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!isModalOpen) return;
    if (!auth.user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getWeeklySlotAvailability();
        if (!cancelled) setUnavailableByDay(res.unavailable || {});
      } catch {
        if (!cancelled) setUnavailableByDay({});
        toast({
          title: "Disponibilidade",
          description: "Não foi possível carregar os horários indisponíveis. Mostrando todos como disponíveis.",
          variant: "destructive",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isModalOpen, auth.user, toast]);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await userListCustomPackages();
        if (cancelled) return;
        const mapped = rows.map((pkg: CustomPackageRow) => ({
          id: pkg.id,
          sessions: Number(pkg.sessions_count),
          title: pkg.title,
          pricePerSession: Number(pkg.price_per_session),
          totalPrice: Number(pkg.total_price),
          paymentUrl: pkg.payment_url,
        }));
        setCustomPackages(mapped);
      } catch {
        if (!cancelled) setCustomPackages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  const isUnavailable = useMemo(() => {
    return (dayId: string, time: string) => {
      const arr = unavailableByDay?.[dayId] ?? [];
      return arr.includes(time);
    };
  }, [unavailableByDay]);

  const isSlotSelected = (dayId: string, time: string) => {
    return selectedSlots.some(slot => slot.dayId === dayId && slot.time === time);
  };

  const handleSlotToggle = (dayId: string, time: string) => {
    const isCurrentlySelected = isSlotSelected(dayId, time);
    
    if (isCurrentlySelected) {
      setSelectedSlots(prev => prev.filter(slot => !(slot.dayId === dayId && slot.time === time)));
    } else {
      if (selectedSlots.length >= 3) return;
      if (isUnavailable(dayId, time)) return;
      setSelectedSlots(prev => [...prev, { dayId, time }]);
    }
  };

  const toggleDayOpen = (dayId: string) => {
    setOpenDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId]
    );
  };

  const getSelectedSlotsForDay = (dayId: string) => {
    return selectedSlots.filter(slot => slot.dayId === dayId);
  };

  const handleFinalizePurchase = () => {
    if (!selectedPackage) {
      toast({ title: "Selecione um pacote", description: "Escolha um pacote antes de finalizar.", variant: "destructive" });
      return;
    }

    const url = paymentLinks[selectedPackage.sessions];
    if (!url) {
      toast({
        title: "Link de pagamento indisponível",
        description: `Não encontrei link para ${selectedPackage.sessions} sessões.`,
        variant: "destructive",
      });
      return;
    }

    // Tenta registrar a intenção de compra (para o admin visualizar).
    // Não bloqueia o redirecionamento se falhar.
    void (async () => {
      try {
        await userRegisterPurchaseIntent({
          package_sessions: selectedPackage.sessions,
          selected_slots: selectedSlots,
        });
      } catch {
        // ignore
      } finally {
    // Fecha o modal antes de redirecionar
    setIsModalOpen(false);
    setSelectedPackage(null);
    setSelectedSlots([]);
    setOpenDays([]);

    // Redireciona para o checkout do Mercado Pago (mesma aba)
    window.location.href = url;
      }
    })();
  };

  const handleCustomBuy = async (pkg: CustomPackageOption) => {
    if (!pkg.paymentUrl) {
      toast({
        title: "Link de pagamento indisponível",
        description: "Não foi possível abrir o pagamento deste pacote.",
        variant: "destructive",
      });
      return;
    }
    try {
      await userRegisterPurchaseIntent({ package_sessions: pkg.sessions });
    } catch {
      // ignore
    }
    window.location.href = pkg.paymentUrl;
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPackage(null);
    setSelectedSlots([]);
    setOpenDays([]);
  };

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Package size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-3">
            Catálogo de Pacotes de Sessões
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha o pacote ideal para o acompanhamento fonoaudiológico. Quanto mais sessões, maior o desconto!
          </p>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {packages.map((pkg, index) => (
            <div
              key={pkg.id}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-lg transition-all duration-300 animate-fade-in flex flex-col"
              style={{ animationDelay: `${0.05 * index}s` }}
            >
              {/* Sessions Badge */}
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{pkg.sessions}</span>
                </div>
              </div>

              {/* Package Info */}
              <div className="text-center flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {pkg.sessions} {pkg.sessions === 1 ? "Sessão" : "Sessões"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {getPricePerSession(pkg.sessions, pkg.price)} por sessão
                </p>
                <div className="text-2xl font-bold text-foreground mb-6">
                  {formatPrice(pkg.price)}
                </div>
              </div>

              {/* Buy Button */}
              <Button
                onClick={() => handleBuyClick(pkg)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShoppingCart size={18} className="mr-2" />
                Comprar
              </Button>
            </div>
          ))}
          {customPackages.map((pkg, index) => (
            <div
              key={`custom-${pkg.id}`}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-lg transition-all duration-300 animate-fade-in flex flex-col"
              style={{ animationDelay: `${0.05 * (packages.length + index)}s` }}
            >
              {/* Sessions Badge */}
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{pkg.sessions}</span>
                </div>
              </div>

              {/* Package Info */}
              <div className="text-center flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">{pkg.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {formatPrice(pkg.pricePerSession)} por sessão
                </p>
                <div className="text-2xl font-bold text-foreground mb-6">
                  {formatPrice(pkg.totalPrice)}
                </div>
              </div>

              {/* Buy Button */}
              <Button
                onClick={() => void handleCustomBuy(pkg)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShoppingCart size={18} className="mr-2" />
                Comprar
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduling Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Calendar size={20} className="text-primary" />
              Selecione dias e horários
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {selectedPackage && (
              <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Pacote selecionado</p>
                <p className="font-semibold text-foreground">
                  {selectedPackage.sessions} sessões - {formatPrice(selectedPackage.price)}
                </p>
              </div>
            )}

            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Selecione até <strong className="text-foreground">3 combinações</strong> de dia e horário para suas sessões:
              </p>
              {selectedSlots.length >= 3 && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                  Você pode selecionar até 3 opções de dias e horários.
                </p>
              )}
            </div>

            {/* Desktop: Columns Layout */}
            <div className="hidden md:grid md:grid-cols-5 gap-3">
              {weekDays.map((day) => {
                const daySlots = getSelectedSlotsForDay(day.id);
                
                return (
                  <div key={day.id} className="flex flex-col">
                    <div className={cn(
                      "text-center p-3 rounded-t-xl border-x border-t font-semibold text-sm",
                      daySlots.length > 0 
                        ? "bg-primary/10 border-primary/30 text-primary" 
                        : "bg-muted/50 border-border text-foreground"
                    )}>
                      {day.shortLabel}
                      {daySlots.length > 0 && (
                        <span className="ml-1 text-xs">({daySlots.length})</span>
                      )}
                    </div>
                    <div className="border-x border-b border-border rounded-b-xl bg-card p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                      {availableTimes.map((time) => {
                        const isSelected = isSlotSelected(day.id, time);
                        const blockedByLimit = !isSelected && selectedSlots.length >= 3;
                        const blockedByConflict = !isSelected && isUnavailable(day.id, time);
                        const isDisabled = blockedByLimit || blockedByConflict;
                        
                        return (
                          <button
                            key={`${day.id}-${time}`}
                            onClick={() => handleSlotToggle(day.id, time)}
                            disabled={isDisabled}
                            className={cn(
                              "w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1",
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : isDisabled
                                ? blockedByConflict
                                  ? "bg-destructive/10 text-destructive border border-destructive/20 cursor-not-allowed"
                                  : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                                : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            )}
                          >
                            {isSelected && <Check size={12} />}
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile: Accordion Layout */}
            <div className="md:hidden space-y-3">
              {weekDays.map((day) => {
                const daySlots = getSelectedSlotsForDay(day.id);
                const isOpen = openDays.includes(day.id);
                
                return (
                  <Collapsible key={day.id} open={isOpen} onOpenChange={() => toggleDayOpen(day.id)}>
                    <CollapsibleTrigger className="w-full">
                      <div className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                        daySlots.length > 0 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-card border-border hover:border-primary/30"
                      )}>
                        <div className="flex items-center gap-3">
                          <Calendar size={18} className={daySlots.length > 0 ? "text-primary" : "text-muted-foreground"} />
                          <span className={cn(
                            "font-medium",
                            daySlots.length > 0 ? "text-primary" : "text-foreground"
                          )}>
                            {day.label}
                          </span>
                          {daySlots.length > 0 && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              {daySlots.length} selecionado{daySlots.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <ChevronDown 
                          size={18} 
                          className={cn(
                            "text-muted-foreground transition-transform duration-200",
                            isOpen && "rotate-180"
                          )} 
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-3 gap-2 p-3 mt-1 bg-muted/30 rounded-xl">
                        {availableTimes.map((time) => {
                          const isSelected = isSlotSelected(day.id, time);
                          const blockedByLimit = !isSelected && selectedSlots.length >= 3;
                          const blockedByConflict = !isSelected && isUnavailable(day.id, time);
                          const isDisabled = blockedByLimit || blockedByConflict;
                          
                          return (
                            <button
                              key={`${day.id}-${time}`}
                              onClick={() => handleSlotToggle(day.id, time)}
                              disabled={isDisabled}
                              className={cn(
                                "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1",
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : isDisabled
                                  ? blockedByConflict
                                    ? "bg-destructive/10 text-destructive border border-destructive/20 cursor-not-allowed"
                                    : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                                  : "bg-card text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border"
                              )}
                            >
                              <Clock size={12} className={isSelected ? "text-primary-foreground" : ""} />
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>

            {/* Selected Slots Summary */}
            {selectedSlots.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-secondary/10 border border-secondary/30">
                <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Check size={16} className="text-secondary" />
                  Seleções ({selectedSlots.length}/3):
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedSlots.map((slot, index) => {
                    const day = weekDays.find(d => d.id === slot.dayId);
                    return (
                      <span 
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-secondary/20 text-secondary-foreground rounded-full text-sm"
                      >
                        {day?.shortLabel} {slot.time}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFinalizePurchase}
              disabled={selectedSlots.length === 0}
              className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            >
              Finalizar pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientPackages;
