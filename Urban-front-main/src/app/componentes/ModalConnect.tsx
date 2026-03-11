import React, { useState } from 'react';
import { Button } from '@chakra-ui/react'; // Importa Button do Chakra UI

const ModalContent = () => {
  // Estado para controlar a visibilidade do modal
  const [isOpen, setIsOpen] = useState(true);
  
  // Funções para abrir e fechar o modal
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
  
  return (
    <>
      <button 
        onClick={onOpen} 
        className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-200"
      >
        Abrir Modal
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto">
          {/* ModalOverlay */}
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose}></div>
          
          {/* ModalContent */}
          <div className="relative bg-white rounded-xl p-2 max-w-4xl mx-4 z-10 shadow-lg">
            {/* ModalCloseButton usando Button do Chakra UI */}
            <Button
              onClick={onClose}
              position="absolute"
              top="1rem"
              right="1rem"
              size="sm"
              variant="ghost"
              colorScheme="gray"
              aria-label="Fechar modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
            
            {/* ModalHeader */}
            <div className="pt-8 pb-2 text-2xl font-bold px-6">
              Conecte sua conta do Airbnb
            </div>
            
            {/* ModalBody */}
            <div className="pb-6 px-6">
              <p className="text-md mb-4">
                Urban AI nunca acessará ou armazenará suas informações de login do Airbnb.
              </p>
              
              <p className="text-md mb-6">
                Ao conectar sua conta do Airbnb, Urban AI pode ajudá-lo a otimizar seus preços para eventos e feriados. Você pode
                desconectar a qualquer momento.
              </p>
              
              {/* Card */}
              <div className="border border-gray-200 rounded-lg mb-6">
                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium mb-1">
                        Precificação baseada em eventos
                      </p>
                      <p className="text-gray-600">
                        Ganhe mais elevando automaticamente seu preço noturno para eventos especiais e feriados
                      </p>
                    </div>
                    <button className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-4 rounded-lg">
                      Saiba mais
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Button */}
              <button 
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg mb-6 flex items-center"
              >
                <span className="mr-2 text-xl">⊕</span> Conectar ao Airbnb
              </button>
              
              {/* Stack */}
              <div className="space-y-5">
                {/* Checkbox 1 */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-1 mr-3 accent-blue-500"
                  />
                  <span>Acesso aos detalhes do seu anúncio, incluindo localização, fotos e descrições</span>
                </label>
                
                {/* Checkbox 2 */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-1 mr-3 accent-blue-500"
                  />
                  <span>Capacidade de criar, atualizar e excluir seus anúncios</span>
                </label>
                
                {/* Checkbox 3 */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-1 mr-3 accent-blue-500"
                  />
                  <span>Acesso ao calendário do seu anúncio, incluindo datas bloqueadas, reservas de hóspedes e disponibilidade</span>
                </label>
                
                {/* Checkbox 4 */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-1 mr-3 accent-blue-500"
                  />
                  <span>Capacidade de criar, atualizar e excluir suas configurações de preços, incluindo preço base, preço de fim de semana e preço baseado em eventos</span>
                </label>
                
                {/* Checkbox 5 */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-1 mr-3 accent-blue-500"
                  />
                  <span>Acesso aos detalhes da sua reserva, incluindo informações do hóspede, horários de check-in e check-out e status do pagamento</span>
                </label>
                
                {/* Checkbox 6 */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-1 mr-3 accent-blue-500"
                  />
                  <span>Capacidade de enviar mensagens aos seus hóspedes, incluindo instruções pré-chegada e avaliações pós-estadia</span>
                </label>
              </div>
              
              <p className="text-sm mt-6 mb-2">
                Você pode desconectar a qualquer momento. Urban AI não acessará nem armazenará suas credenciais de login do Airbnb.
              </p>
              
              <p className="text-sm">
                Ao clicar em Conectar ao Airbnb, você concorda com os Termos de Serviço e Política de Privacidade da Urban AI.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModalContent;
