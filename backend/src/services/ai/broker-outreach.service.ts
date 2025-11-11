import OpenAI from 'openai';
import fleetProfile from '../../config/fleet-profile';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface BrokerData {
  name: string;
  email: string;
  totalLoads: number;
  avgRate: number;
  topLanes: string[];
  relationshipScore: number;
  lastLoadDate?: Date;
}

interface EmailDraft {
  subject: string;
  body: string;
  type: 'new_intro' | 'relationship_builder' | 'dedicated_lane' | 'follow_up';
  broker: string;
  reasoning: string;
}

export class BrokerOutreachService {
  
  /**
   * Generate personalized email for a broker
   */
  async generateOutreachEmail(broker: BrokerData): Promise<EmailDraft> {
    const emailType = this.determineEmailType(broker);
    const prompt = this.buildPrompt(broker, emailType);

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are Harpreet Dhaliwal, Fleet Manager at ${fleetProfile.company.name}, writing a personal email to a freight broker.

Write natural, conversational emails that sound human - not corporate templates. Use this flow:

OPENING:
Start with "Hi [Broker Name] Team," and a brief, friendly opener about why you're reaching out.

IF THEY'VE WORKED WITH US:
Add a natural paragraph like: "We've recently worked together on [X] loads with an average rate of $[X.XX]/mile. We appreciated the opportunity and are hoping to build on that momentum."

OUR CAPABILITIES (use this exact format with asterisks):
* Fleet: 3 Freightliner Cascadia 126 trucks
* Equipment: 2 reefer units, 1 dry van
* Coverage: Comprehensive service across TX to ME
* Insurance: $1,000,000 coverage per occurrence

PERSONALIZED PITCH:
Write a natural paragraph about why you're reaching out. Mention their specific lanes if known. Talk about what you're looking for in a broker partner (consistency, communication, on-time performance). Make it conversational, not salesy.

CALL TO ACTION:
End with something simple like "Would you be open to a quick call to see how Royal Carriers Inc. can help move your freight more reliably?"

SIGNATURE (exact format):
Best regards,
Harpreet Dhaliwal
Fleet Manager
Royal Carriers Inc.
royalcarrier3@gmail.com
(469) 394-7061

CRITICAL RULES:
- Sound like a real person, not a corporate robot
- No ALL CAPS section headers in the email body
- Keep it under 200 words
- Be specific about lanes/needs when you can
- NEVER use placeholders
- Make it feel like you actually typed this email yourself`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content || '';
      const { subject, body } = this.parseEmailResponse(response);

      // Post-process to ensure no placeholders remain
      const cleanBody = this.removePlaceholders(body);

      return {
        subject,
        body: cleanBody,
        type: emailType,
        broker: broker.name,
        reasoning: this.getEmailReasoning(broker, emailType)
      };

    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to generate email');
    }
  }

  /**
   * Remove any remaining placeholders from email body
   */
  private removePlaceholders(body: string): string {
    let cleanBody = body;

    // Replace common placeholders with actual values
    const replacements: { [key: string]: string } = {
      '\\[Your Name\\]': 'Harpreet Dhaliwal',
      '\\[Your Full Name\\]': 'Harpreet Dhaliwal',
      '\\[Name\\]': 'Harpreet Dhaliwal',
      '\\[Your Position\\]': 'Fleet Manager',
      '\\[Your Title\\]': 'Fleet Manager',
      '\\[Position\\]': 'Fleet Manager',
      '\\[Title\\]': 'Fleet Manager',
      '\\[Company Name\\]': 'Royal Carriers Inc.',
      '\\[Your Company\\]': 'Royal Carriers Inc.',
      '\\[Your Contact Information\\]': 'royalcarrier3@gmail.com | (469) 394-7061',
      '\\[Contact Information\\]': 'royalcarrier3@gmail.com | (469) 394-7061',
      '\\[Your Email\\]': 'royalcarrier3@gmail.com',
      '\\[Email\\]': 'royalcarrier3@gmail.com',
      '\\[Your Phone\\]': '(469) 394-7061',
      '\\[Phone Number\\]': '(469) 394-7061',
      '\\[Phone\\]': '(469) 394-7061',
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      cleanBody = cleanBody.replace(new RegExp(placeholder, 'gi'), value);
    });

    // Remove any lines that still contain bracket placeholders
    cleanBody = cleanBody.split('\n').filter(line => !line.match(/\[.*?\]/)).join('\n');

    // Always ensure clean signature at end
    const cleanSignature = '\n\nBest regards,\nHarpreet Dhaliwal\nFleet Manager\nRoyal Carriers Inc.\nroyalcarrier3@gmail.com\n(469) 394-7061';
    
    // Remove any existing signature lines to avoid duplicates
    cleanBody = cleanBody.replace(/Best regards,?[\s\S]*$/i, '');
    cleanBody = cleanBody.replace(/Sincerely,?[\s\S]*$/i, '');
    cleanBody = cleanBody.replace(/Regards,?[\s\S]*$/i, '');
    
    // Add clean signature
    cleanBody = cleanBody.trim() + cleanSignature;

    return cleanBody;
  }

  /**
   * Generate emails for multiple top brokers
   */
  async generateBatchOutreach(brokers: BrokerData[]): Promise<EmailDraft[]> {
    const drafts: EmailDraft[] = [];
    
    for (const broker of brokers) {
      try {
        const draft = await this.generateOutreachEmail(broker);
        drafts.push(draft);
        
        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to generate email for ${broker.name}:`, error);
      }
    }

    return drafts;
  }

  /**
   * Determine best email type based on broker history
   */
  private determineEmailType(broker: BrokerData): EmailDraft['type'] {
    if (broker.totalLoads === 0) {
      return 'new_intro';
    } else if (broker.totalLoads >= 5 && broker.relationshipScore >= 70) {
      return 'dedicated_lane';
    } else if (broker.totalLoads >= 2) {
      return 'relationship_builder';
    } else {
      return 'follow_up';
    }
  }

  /**
   * Build GPT prompt with broker data and fleet info
   */
  private buildPrompt(broker: BrokerData, emailType: EmailDraft['type']): string {
    const fleet = fleetProfile;
    
    let prompt = `Write a professional email to ${broker.name}, a freight broker.\n\n`;
    
    // Add broker context
    if (broker.totalLoads > 0) {
      prompt += `BROKER HISTORY:\n`;
      prompt += `- We've hauled ${broker.totalLoads} loads for them\n`;
      prompt += `- Average rate: $${broker.avgRate.toFixed(2)}/mile\n`;
      if (broker.topLanes.length > 0) {
        prompt += `- Their top lanes: ${broker.topLanes.join(', ')}\n`;
      }
      prompt += `\n`;
    }

    // Add our fleet info
    prompt += `OUR FLEET (${fleet.company.name}):\n`;
    prompt += `- ${fleet.fleet.trucks.count}x ${fleet.fleet.trucks.make} ${fleet.fleet.trucks.model}\n`;
    prompt += `- ${fleet.fleet.capacity}\n`;
    prompt += `- Coverage: ${fleet.coverage.primary_states.join(', ')}\n`;
    prompt += `- Insurance: ${fleet.insurance.liability} / ${fleet.insurance.aggregate}\n`;
    prompt += `\n`;

    // Email type specific instructions
    switch (emailType) {
      case 'new_intro':
        prompt += `EMAIL TYPE: New Broker Introduction\n`;
        prompt += `Goal: Introduce our carrier and capabilities. Mention we've seen their load postings${broker.topLanes.length > 0 ? ` in ${broker.topLanes[0]}` : ''}.\n`;
        break;
      
      case 'relationship_builder':
        prompt += `EMAIL TYPE: Relationship Builder\n`;
        prompt += `Goal: Thank them for the ${broker.totalLoads} loads. Express interest in more consistent work. Highlight our reliability.\n`;
        break;
      
      case 'dedicated_lane':
        prompt += `EMAIL TYPE: Dedicated Lane Pitch\n`;
        prompt += `Goal: Propose a dedicated lane partnership. We've noticed they post ${broker.topLanes[0] || 'similar lanes'} frequently. Offer competitive rates for volume commitment.\n`;
        break;
      
      case 'follow_up':
        prompt += `EMAIL TYPE: Follow-Up\n`;
        prompt += `Goal: Thank them for the first load. Express interest in building a long-term relationship.\n`;
        break;
    }

    prompt += `\nFormat your response as:\nSUBJECT: [subject line]\n\n[email body]\n\nDo not use any placeholders. Sign with the exact name and contact info provided.`;

    return prompt;
  }

  /**
   * Parse GPT response into subject and body
   */
  private parseEmailResponse(response: string): { subject: string; body: string } {
    const lines = response.split('\n');
    let subject = '';
    let body = '';
    let foundSubject = false;

    for (const line of lines) {
      if (line.startsWith('SUBJECT:')) {
        subject = line.replace('SUBJECT:', '').trim();
        foundSubject = true;
      } else if (foundSubject && line.trim()) {
        body += line + '\n';
      }
    }

    return {
      subject: subject || 'Partnership Opportunity with Royal Carriers',
      body: body.trim() || response
    };
  }

  /**
   * Get human-readable reasoning for email generation
   */
  private getEmailReasoning(broker: BrokerData, emailType: EmailDraft['type']): string {
    const avgRate = broker.avgRate.toFixed(2);
    
    switch (emailType) {
      case 'new_intro':
        return `New broker - introducing our carrier capabilities and expressing interest in their ${broker.topLanes[0] || 'posted'} loads`;
      
      case 'relationship_builder':
        return `We've hauled ${broker.totalLoads} loads - time to strengthen the relationship and increase volume`;
      
      case 'dedicated_lane':
        return `High volume broker (${broker.totalLoads} loads, $${avgRate}/mi avg) - perfect candidate for dedicated lane partnership`;
      
      case 'follow_up':
        return `Recent first load - following up to build momentum and secure more business`;
      
      default:
        return 'Building broker relationship';
    }
  }

  /**
   * Identify top brokers for outreach
   */
  getTopOutreachTargets(brokers: BrokerData[], limit: number = 10): BrokerData[] {
    // Scoring algorithm for outreach priority
    return brokers
      .map(broker => ({
        ...broker,
        outreachScore: this.calculateOutreachScore(broker)
      }))
      .sort((a, b) => b.outreachScore - a.outreachScore)
      .slice(0, limit);
  }

  /**
   * Calculate outreach priority score
   */
  private calculateOutreachScore(broker: BrokerData): number {
    let score = 0;

    // Rate score (0-40 points)
    if (broker.avgRate >= 2.50) score += 40;
    else if (broker.avgRate >= 2.00) score += 30;
    else score += 10;

    // Load volume score (0-30 points)
    if (broker.totalLoads === 0) score += 15; // New brokers worth reaching out to
    else if (broker.totalLoads >= 5) score += 30;
    else score += broker.totalLoads * 5;

    // Relationship score (0-30 points)
    score += (broker.relationshipScore / 100) * 30;

    return score;
  }
}

export default new BrokerOutreachService();