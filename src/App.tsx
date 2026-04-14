import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  setDoc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  signInAnonymously,
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { format, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  CreditCard, 
  TrendingUp, 
  ArrowDownCircle, 
  Wallet, 
  LogOut, 
  ChevronRight,
  Calendar,
  DollarSign,
  CheckCircle2,
  X,
  Trash2,
  CloudCheck,
  CloudOff,
  RefreshCw,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface Bill {
  id: string;
  description: string;
  value: number;
  dueDate: string;
  totalInstallments: number;
  paidInstallments: number;
  status: 'pending' | 'paid';
  userId: string;
}

interface Income {
  id: string;
  description: string;
  value: number;
  date: string;
  userId: string;
}

interface UserProfile {
  monthlyIncome: number;
  userId: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'bills'>('list');
  const [addType, setAddType] = useState<'bill' | 'income'>('bill');
  const [isSyncing, setIsSyncing] = useState(false);

  const [isLocked, setIsLocked] = useState(false);

  // Form state
  const [newBill, setNewBill] = useState({
    description: '',
    value: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    totalInstallments: '1'
  });

  const [newIncome, setNewIncome] = useState({
    description: '',
    value: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [authError, setAuthError] = useState<string | null>(null);

  // --- Error Handling ---
  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setIsSyncing(false);
  };

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const login = () => {
    setAuthError(null);
    if (auth.currentUser) {
      setIsLocked(false);
      return;
    }
    
    signInAnonymously(auth).catch(error => {
      console.error("Erro ao entrar anonimamente:", error);
      if (error.code === 'auth/admin-restricted-operation') {
        setAuthError("O 'Login Anônimo' não está ativado no Console do Firebase. Por favor, ative-o em 'Authentication > Sign-in method' para continuar.");
      } else {
        setAuthError("Erro ao entrar. Verifique sua conexão ou configurações do Firebase.");
      }
    });
  };

  const logout = () => {
    // Em contas anônimas, signOut() gera um novo ID e "perde" os dados.
    // Para salvar os dados, apenas bloqueamos a tela sem deslogar.
    setIsLocked(true);
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;

    setIsSyncing(true);
    const billsQuery = query(collection(db, 'bills'), where('userId', '==', user.uid));
    const unsubscribeBills = onSnapshot(billsQuery, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
      setBills(billsData);
      setIsSyncing(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bills'));

    const incomesQuery = query(collection(db, 'incomes'), where('userId', '==', user.uid));
    const unsubscribeIncomes = onSnapshot(incomesQuery, (snapshot) => {
      const incomesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
      setIncomes(incomesData);
      setIsSyncing(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'incomes'));

    const profileRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setDoc(profileRef, { monthlyIncome: 0, userId: user.uid })
          .catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`));
      }
      setIsSyncing(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubscribeBills();
      unsubscribeIncomes();
      unsubscribeProfile();
    };
  }, [user]);

  // --- Actions ---
  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSyncing(true);
    try {
      await addDoc(collection(db, 'bills'), {
        description: newBill.description,
        value: parseFloat(newBill.value),
        dueDate: new Date(newBill.dueDate).toISOString(),
        totalInstallments: parseInt(newBill.totalInstallments),
        paidInstallments: 0,
        status: 'pending',
        userId: user.uid
      });
      setActiveTab('list');
      setNewBill({
        description: '',
        value: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        totalInstallments: '1'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bills');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSyncing(true);
    try {
      await addDoc(collection(db, 'incomes'), {
        description: newIncome.description,
        value: parseFloat(newIncome.value),
        date: new Date(newIncome.date).toISOString(),
        userId: user.uid
      });
      setActiveTab('list');
      setNewIncome({
        description: '',
        value: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'incomes');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePay = async (bill: Bill) => {
    if (bill.status === 'paid') return;

    setIsSyncing(true);
    const nextPaid = bill.paidInstallments + 1;
    const isFinished = nextPaid >= bill.totalInstallments;
    const nextDueDate = addMonths(parseISO(bill.dueDate), 1).toISOString();

    try {
      await updateDoc(doc(db, 'bills', bill.id), {
        paidInstallments: nextPaid,
        status: isFinished ? 'paid' : 'pending',
        dueDate: isFinished ? bill.dueDate : nextDueDate
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bills/${bill.id}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, 'bills', billId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bills/${billId}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteIncome = async (incomeId: string) => {
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, 'incomes', incomeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `incomes/${incomeId}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Calculations ---
  const totalBills = bills.reduce((acc, bill) => bill.status === 'pending' ? acc + bill.value : acc, 0);
  const totalIncome = incomes.reduce((acc, inc) => acc + inc.value, 0);
  const remaining = totalIncome - totalBills;

  if (!isAuthReady) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  if (!user || isLocked) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black p-6 text-center">
        <div className="relative mb-10">
          <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center shadow-2xl border border-zinc-800">
            <Wallet className="text-white w-12 h-12" />
          </div>
          <motion.div 
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: 1, y: -15 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -top-2 -right-2 bg-red-500 p-2 rounded-full shadow-lg"
          >
            <Heart className="text-white w-6 h-6 fill-current" />
          </motion.div>
        </div>
        
        <div className="mb-12">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase">
            YARLLEN & CLARA
          </h1>
          <p className="text-zinc-500 text-lg tracking-[0.3em] uppercase">
            CONTAS
          </p>
        </div>
        
        {authError && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-2xl text-red-400 text-xs font-medium max-w-xs">
            {authError}
            <a 
              href="https://console.firebase.google.com/project/gen-lang-client-0700766888/authentication/providers" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block mt-2 underline font-bold"
            >
              Clique aqui para ativar no Console
            </a>
          </div>
        )}

        <button 
          onClick={login}
          className="bg-white text-black px-12 py-5 rounded-2xl font-black text-lg flex items-center gap-3 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/10"
        >
          Entrar no Aplicativo
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-0 sm:p-4">
      <div className="phone-frame bg-white flex flex-col">
        {/* Status Bar Mock */}
        <div className="h-11 px-8 flex justify-between items-center text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span>{format(new Date(), 'HH:mm')}</span>
            {isSyncing ? (
              <RefreshCw size={10} className="animate-spin text-blue-500" />
            ) : (
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            )}
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-2.5 border border-gray-400 rounded-sm relative">
              <div className="absolute inset-0.5 bg-gray-600 rounded-sm w-2"></div>
            </div>
            <span>📶</span>
          </div>
        </div>

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              {activeTab === 'list' ? 'Resumo' : (activeTab === 'add' ? (addType === 'bill' ? 'Nova Conta' : 'Nova Entrada') : 'Gerenciar Contas')}
            </h1>
            <p className="text-sm text-gray-500">
              {activeTab === 'list' ? format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }) : (activeTab === 'add' ? 'Cadastre uma movimentação' : 'Lista completa de registros')}
            </p>
          </div>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {activeTab === 'list' ? (
            <>
              {/* Bento Grid Summary */}
              <div className="grid grid-cols-2 gap-3 px-6 mb-6">
                <div className="bento-card-wide p-6 rounded-[28px] flex flex-col justify-between min-h-[140px]">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">Saldo Restante</span>
                    <Wallet size={20} className="opacity-50" />
                  </div>
                  <div>
                    <div className="text-3xl font-black mb-1">
                      R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs opacity-60">Sincronizado na nuvem</div>
                  </div>
                </div>

                <div className="bento-card p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Entradas</span>
                    <TrendingUp size={14} className="text-emerald-500" />
                  </div>
                  <div className="text-lg font-bold text-emerald-600">
                    R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bento-card p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pendentes</span>
                    <ArrowDownCircle size={14} className="text-red-500" />
                  </div>
                  <div className="text-lg font-bold text-red-600">
                    R$ {totalBills.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Bills List (Pending Only) */}
              <div className="px-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Contas a Pagar</h2>
                  <span className="text-xs font-medium text-gray-400">{bills.filter(b => b.status === 'pending').length} itens</span>
                </div>

                <div className="space-y-3">
                  {bills.filter(b => b.status === 'pending').length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <CreditCard className="mx-auto text-gray-300 mb-2" size={32} />
                      <p className="text-sm text-gray-400">Nenhuma conta pendente</p>
                    </div>
                  )}
                  {bills
                    .filter(b => b.status === 'pending')
                    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                    .map((bill) => (
                    <motion.div 
                      layout
                      key={bill.id} 
                      className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm flex items-center justify-between transition-all"
                    >
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm">{bill.description}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            <Calendar size={10} />
                            {format(parseISO(bill.dueDate), 'dd/MM')}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            <Plus size={10} />
                            {bill.paidInstallments}/{bill.totalInstallments}
                          </span>
                          <span className="text-xs font-black text-gray-900">
                            R$ {bill.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handlePay(bill)}
                        className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors active:scale-95"
                      >
                        Pagar
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </>
          ) : activeTab === 'add' ? (
            /* Add Screen */
            <div className="px-6 pt-4">
              <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
                <button 
                  onClick={() => setAddType('bill')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${addType === 'bill' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                >
                  Nova Conta
                </button>
                <button 
                  onClick={() => setAddType('income')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${addType === 'income' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                >
                  Nova Entrada
                </button>
              </div>

              {addType === 'bill' ? (
                <form onSubmit={handleAddBill} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Do que se trata?</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Aluguel, Luz, Internet"
                      value={newBill.description}
                      onChange={(e) => setNewBill({...newBill, description: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Qual o valor?</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        placeholder="0,00"
                        value={newBill.value}
                        onChange={(e) => setNewBill({...newBill, value: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 pl-10 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Vencimento</label>
                      <input 
                        required
                        type="date" 
                        value={newBill.dueDate}
                        onChange={(e) => setNewBill({...newBill, dueDate: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Parcelas</label>
                      <input 
                        required
                        type="number" 
                        min="1"
                        value={newBill.totalInstallments}
                        onChange={(e) => setNewBill({...newBill, totalInstallments: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSyncing}
                    className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] mt-4 disabled:opacity-50"
                  >
                    {isSyncing ? 'Salvando...' : 'Adicionar Conta'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddIncome} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Fonte da Entrada</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Salário, Freelance, Bônus"
                      value={newIncome.description}
                      onChange={(e) => setNewIncome({...newIncome, description: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Qual o valor?</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        placeholder="0,00"
                        value={newIncome.value}
                        onChange={(e) => setNewIncome({...newIncome, value: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 pl-10 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Data de Recebimento</label>
                    <input 
                      required
                      type="date" 
                      value={newIncome.date}
                      onChange={(e) => setNewIncome({...newIncome, date: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSyncing}
                    className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98] mt-4 disabled:opacity-50"
                  >
                    {isSyncing ? 'Salvando...' : 'Adicionar Entrada'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Bills Management Screen */
            <div className="px-6 pt-4">
              <div className="space-y-6">
                {/* Bills Section */}
                <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Todas as Contas</h2>
                  <div className="space-y-3">
                    {bills.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma conta encontrada</p>}
                    {bills.map(bill => (
                      <div key={bill.id} className="p-4 rounded-2xl border border-gray-100 bg-white flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{bill.description}</h3>
                          <p className="text-[10px] text-gray-400 font-bold">
                            R$ {bill.value.toLocaleString('pt-BR')} • {bill.paidInstallments}/{bill.totalInstallments} parc.
                          </p>
                        </div>
                        <button 
                          onClick={() => handleDeleteBill(bill.id)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Incomes Section */}
                <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Todas as Entradas</h2>
                  <div className="space-y-3">
                    {incomes.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma entrada encontrada</p>}
                    {incomes.map(income => (
                      <div key={income.id} className="p-4 rounded-2xl border border-gray-100 bg-emerald-50/30 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-emerald-900 text-sm">{income.description}</h3>
                          <p className="text-[10px] text-emerald-600/60 font-bold">
                            R$ {income.value.toLocaleString('pt-BR')} • {format(parseISO(income.date), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleDeleteIncome(income.id)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-center">
          <div className="bg-gray-900 rounded-full p-1.5 flex gap-1 shadow-2xl">
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2.5 rounded-full text-[10px] font-bold transition-all ${
                activeTab === 'list' ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'
              }`}
            >
              Resumo
            </button>
            <button 
              onClick={() => setActiveTab('add')}
              className={`px-4 py-2.5 rounded-full text-[10px] font-bold transition-all ${
                activeTab === 'add' ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'
              }`}
            >
              Adicionar
            </button>
            <button 
              onClick={() => setActiveTab('bills')}
              className={`px-4 py-2.5 rounded-full text-[10px] font-bold transition-all ${
                activeTab === 'bills' ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'
              }`}
            >
              Contas
            </button>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="h-8 flex justify-center items-center">
          <div className="w-32 h-1.5 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
