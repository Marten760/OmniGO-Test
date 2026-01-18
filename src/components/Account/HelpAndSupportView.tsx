import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "../ui/accordion";

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={`bg-gray-800 border border-gray-700 rounded-2xl ${className}`}>{children}</div>
);
const Button = ({ onClick, className, children, disabled, type }: { onClick?: (e: React.FormEvent) => void, className?: string, children: React.ReactNode, disabled?: boolean, type?: "submit" | "button" | "reset" }) => (
    <button onClick={onClick} className={className} disabled={disabled} type={type}>{children}</button>
);

export function HelpAndSupportView({ onBack }: { onBack: () => void }) {
    const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const createSupportTicket = useMutation(api.support.createSupportTicket);

    const faqs = [
        {
            question: "How do I pay with Pi?",
            answer: "When you're ready to checkout, simply select the 'Pay with Pi Wallet' button. This will open the Pi Wallet interface for you to confirm the transaction securely."
        },
        {
            question: "How can I track my order?",
            answer: "You can track your order status in real-time from the 'Order History' section. You will also receive notifications as your order is confirmed, prepared, and out for delivery."
        },
        {
            question: "How do I add a store to my favorites?",
            answer: "On any store's page, you will find a heart icon. Tap it to add the store to your favorites list, which you can access from your account page."
        },
        {
            question: "Can I cancel my order?",
            answer: "You can cancel an order only before the store confirms it. Once the status changes to 'Confirmed' or 'Preparing', cancellation is no longer possible."
        }
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionToken) return;

        toast.promise(createSupportTicket({ tokenIdentifier: sessionToken, subject, message }), {
            loading: 'Sending your message...',
            success: () => {
                setSubject('');
                setMessage('');
                return 'Your message has been sent! We will get back to you shortly.';
            },
            error: (err) => err.data || 'Failed to send message.',
        });
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-bold text-white">Help & Support</h3>
            </div>

            {/* FAQ Section */}
            <div className="mb-8">
                <h4 className="text-lg font-semibold text-white mb-4">Frequently Asked Questions</h4>
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`} className="border-gray-700">
                            <AccordionTrigger className="text-white hover:no-underline">{faq.question}</AccordionTrigger>
                            <AccordionContent className="text-gray-400">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>

            {/* Contact Form Section */}
            <div>
                <h4 className="text-lg font-semibold text-white mb-4">Still need help? Contact us.</h4>
                <Card>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="text-sm text-gray-400">Subject</label>
                            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={5} className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                        </div>
                        <div>
                            <label className="text-sm text-gray-400">Message</label>
                            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required minLength={20} rows={4} className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">Send Message</Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}