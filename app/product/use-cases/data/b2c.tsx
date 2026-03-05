import { Building, Stethoscope, GraduationCap } from '@/app/components/ui/icons';

export const b2cUseCases = [
  {
    id: 'b2c-real-estate',
    name: 'Real Estate',
    category: 'B2C',
    categories: ['All', 'B2C', 'SMBs', 'Enterprise', 'Solopreneurs'],
    description: 'Qualify potential buyers and automate property follow-ups.',
    seoTitle: 'Real Estate Lead Follow-Up Automation | AI Agents | Makinari',
    seoDescription: 'Qualify potential homebuyers instantly. Automate property inquiry follow-ups and schedule viewings using Makinari AI agents.',
    longDescription: `The residential and commercial real estate industry is completely driven by speed-to-lead. Top-producing real estate agents and brokerages often generate hundreds of inbound leads every single month from major property portals like Zillow, Realtor.com, their own IDX websites, and paid Facebook ads. However, the harsh reality is that a staggering 90% of these portal leads never convert, simply because the agent is physically unable to reply to every single inquiry within the critical first five minutes. By the time an agent finishes a showing and calls the lead back two hours later, that prospective buyer has already moved on and engaged a competitor.

Makinari operates as your dedicated, 24/7 inside sales agent (ISA). The moment a buyer submits an inquiry about a property listing, a Makinari AI agent instantly engages them via SMS or WhatsApp. The AI is highly conversational and completely indistinguishable from a human assistant. It immediately asks qualifying questions regarding the buyer's budget, their desired timeline to move, whether they are already working with another agent, and most importantly, if they are pre-approved for a mortgage. 

Once the AI agent determines the lead is highly qualified, it seamlessly transitions into scheduling a property viewing or an initial buyer consultation directly onto your calendar. Furthermore, for the vast majority of leads who are "just looking" and may be 6 to 12 months out from purchasing, Makinari automatically places them into a long-term, multi-channel nurturing sequence. It periodically sends them hyper-local market updates, new listings matching their criteria, and helpful guides on the home-buying process, ensuring that when they are finally ready to transact, you are the only agent they call.`,
    keyWorkflows: [
      'Instantly engage, qualify, and converse with 100% of your inbound property portal leads via SMS/Email within seconds, 24/7/365.',
      'Automatically schedule highly qualified property viewings, buyer consultations, and send automated open house calendar invitations and reminders.',
      'Relentlessly nurture long-term, top-of-funnel buyers who are 6-12 months out from purchasing with personalized, value-driven market content.'
    ],
    expectedOutcomes: 'Never lose a single lead to a competitor due to slow response times again, resulting in a proven 40% increase in attended property viewings and a massive spike in Gross Commission Income (GCI).',
    timeToValue: '1 week',
    icon: <Building className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'b2c-healthcare',
    name: 'Clinics & Healthcare',
    category: 'B2C',
    categories: ['All', 'B2C', 'SMBs', 'Enterprise'],
    description: 'Attract and manage new patients through segmented campaigns and automatic follow-ups.',
    seoTitle: 'Patient Acquisition & Booking Automation for Clinics | Makinari',
    seoDescription: 'Attract and manage new patients securely. Automate appointment booking, follow-ups, and recall campaigns for your healthcare clinic.',
    longDescription: `Running a profitable private healthcare clinic—whether it's a dental practice, a medical aesthetics med-spa, a physical therapy center, or a specialized chiropractic office—requires maintaining a consistently full schedule. However, clinics lose hundreds of thousands of dollars in potential revenue every year due to two massive operational failures: missing incoming phone calls from new patients when the front desk is busy, and failing to effectively run patient recall systems to reactivate past patients who are overdue for routine care.

Makinari serves as a digital extension of your front desk, ensuring that your clinic operates at maximum capacity. When a prospective patient lands on your website or clicks your Google Ad late at night after the clinic is closed, a Makinari AI agent immediately answers their preliminary questions. The AI can securely access your practice management software's API to offer real-time availability, allowing the patient to seamlessly book their initial consultation or treatment without ever needing to speak to a receptionist. 

Beyond new patient acquisition, Makinari automates the critical, revenue-generating task of patient recall. Instead of having a receptionist manually call a list of 500 patients who haven't been seen in six months—a task that is universally hated and rarely completed—Makinari executes highly segmented, automated SMS and email campaigns. The AI agent cross-references patient records (via secure, HIPAA-compliant integrations) and sends personalized reminders: "Hi Sarah, it's been exactly 6 months since your last teeth cleaning. We have an opening next Tuesday at 2 PM. Would you like me to book that for you?" If the patient replies "Yes," the AI handles the booking entirely autonomously. Furthermore, Makinari sends automated pre-appointment reminders and post-appointment review requests, drastically reducing no-show rates and boosting your clinic's local SEO presence through increased 5-star Google reviews.`,
    keyWorkflows: [
      'Automate 24/7 new patient appointment booking and instantly answer preliminary, non-clinical FAQ inquiries regarding insurance, location, and pricing.',
      'Send highly reliable, automated pre-appointment SMS reminders to drastically reduce devastating no-show rates that cripple daily clinic revenue.',
      'Execute highly segmented, automated recall campaigns targeting dormant patients for routine check-ups, follow-up treatments, and high-margin elective procedures.'
    ],
    expectedOutcomes: 'Maximize clinic chair utilization rates to near 100%, reduce the crushing administrative burden on your front-desk staff by half, decrease no-show rates by up to 70%, and generate a predictable stream of recurring patient revenue.',
    timeToValue: '2 weeks',
    icon: <Stethoscope className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'b2c-education',
    name: 'Education & Courses',
    category: 'B2C',
    categories: ['All', 'B2C', 'Solopreneurs', 'SMBs', 'Enterprise'],
    description: 'Increase enrollment by qualifying leads and nurturing prospects until registration.',
    seoTitle: 'Student Enrollment Automation for Education | Makinari',
    seoDescription: 'Increase course and school enrollments. Use Makinari to qualify student leads, nurture prospects, and automate the registration process.',
    longDescription: `The student enrollment journey—whether for an intensive 12-week coding bootcamp, a specialized language school, a certification program, or even a traditional university degree—is exceptionally long, highly deliberative, and requires constant, personalized nurturing. A prospective student rarely visits a website and pays a $5,000 tuition deposit on the same day. They download a syllabus, attend an info session, compare your curriculum against competitors, and agonizingly deliberate over the financial commitment. If your admissions team fails to nurture them effectively at every single touchpoint, they will inevitably drop out of the funnel or enroll elsewhere.

Makinari acts as an automated, highly empathetic admissions counselor, guiding prospective students through the entire, multi-stage enrollment funnel. When a lead downloads a course syllabus, a Makinari AI agent instantly initiates a personalized conversation. It dynamically answers highly specific curriculum questions by referencing your entire course catalog, assists with preliminary inquiries regarding financial aid, payment plans, or job placement rates, and gently pushes the prospect toward critical application deadlines.

For example, if a prospect attends a virtual open house but fails to submit their application within 48 hours, the Makinari agent automatically triggers a follow-up sequence. The agent might send a highly relevant success story or a video testimonial from an alumni who transitioned into a similar career path. As the enrollment deadline approaches, the AI seamlessly handles the administrative heavy lifting: reminding the student to submit outstanding registration documents, assisting them with tuition deposit links, and confirming their cohort start date. By providing immediate answers and consistent, personalized encouragement, Makinari ensures that high-intent prospects successfully cross the finish line.`,
    keyWorkflows: [
      'Instantly engage and qualify prospective students inquiring about specific course details, prerequisites, and highly nuanced curriculum outcomes.',
      'Automate sophisticated, multi-channel follow-up sequences leading up to critical application, financial aid, and final enrollment deadlines.',
      'Streamline the tedious administrative collection of necessary registration documents, transcripts, and secure tuition deposits.'
    ],
    expectedOutcomes: 'Increase total cohort enrollments by up to 25% by actively preventing high-intent prospects from dropping off during the critical consideration phase, while simultaneously freeing your admissions team to focus only on complex student interviews.',
    timeToValue: '2 weeks',
    icon: <GraduationCap className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  }
];
