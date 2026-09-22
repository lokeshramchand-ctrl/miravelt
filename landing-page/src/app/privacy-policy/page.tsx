import type { Metadata } from "next";
import { Header } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/Header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Auvren collects, uses, and protects your financial data and personal information.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mt-6 mb-2 text-[19px] font-bold text-[#707785]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10">
      <h2 className="mb-4 text-[18px] font-medium tracking-[-0.025em] text-[#020203] md:text-[20px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-[#f5f5f7] px-4 py-16 md:px-4 md:py-12">
      <Header />

      <h1 className="w-full max-w-[800px] text-left text-[60px] leading-[1] font-normal tracking-[-0.055em] text-[#020203] md:mb-4">
        Privacy Policy
      </h1>
      <p className="mb-6 w-full max-w-[800px] text-left text-[14px] text-[#707785] md:mb-8">
        Last Updated: September 10, 2026
      </p>

      <div className="w-full max-w-[800px] rounded-[32px] bg-[#fcfcfd] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)] md:rounded-[52px] md:p-[52px]">
        <div className="font-sans text-[15px] leading-[1.5] text-[#707785] md:text-[16px] [&_strong]:text-[#020203] [&_a]:underline [&_a]:underline-offset-[0.14em] [&_li]:mb-2 [&_li]:leading-[1.5] [&_p]:mb-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6">
          <Section id="gmail" title="Gmail connection and privacy">
            <p>
              This section applies when you connect Gmail to Auvren. It
              supplements our website privacy policy and controls how we
              handle Google user data if another section of this policy
              differs.
            </p>

            <SubSection title="Information we access">
              <p>
                Connecting Gmail is optional. With your permission, Auvren can
                access your connected email address, message headers,
                senders, recipients, subjects, message bodies, and
                attachments. Google&rsquo;s read-only permission applies
                across your mailbox; it is not limited by Google to financial
                senders or documents. Our application uses that access for
                the Gmail features described here. This permission does not
                let us send, change, or delete your mail.
              </p>
            </SubSection>

            <SubSection title="How we use your email">
              <p>
                We use Gmail data to carry out searches you request, find
                financial statements, tax forms, and investment updates, and
                help you review and organize relevant information and
                documents in Auvren. Connecting Gmail does not itself enable
                recurring scans. If you separately enable inbox checks, we
                read new messages to identify financial items that may need
                your attention. You can turn these checks off. Relevant
                attachments may be imported into your document vault, and
                information from them may be used in your financial records
                and conversations.
              </p>
            </SubSection>

            <SubSection title="AI processing and service providers">
              <p>
                Message content, attachments, and information derived from
                them may be processed on our servers and by service providers
                that support hosting, document extraction, AI analysis, and
                service operation. This processing supports the Gmail
                features you request or enable, including summaries and
                financial document analysis. Google user data must not be
                used to train or improve general-purpose or shared AI models.
                We limit provider processing to the permitted purposes
                described in this section.
              </p>
            </SubSection>

            <SubSection title="Storage and retention">
              <p>
                We store authorization tokens to maintain your connection,
                along with connection details and records of Gmail activity.
                Imported attachments, extracted financial information,
                findings, and relevant conversation content may be retained
                in Auvren. We retain this information for the features you use
                and for applicable legal, regulatory, security, and
                recordkeeping needs. Retention depends on the type of record
                and those needs; disconnecting Gmail does not automatically
                delete information already imported or recorded.
              </p>
            </SubSection>

            <SubSection title="Disconnecting and requesting deletion">
              <p>
                You can disconnect Gmail in Auvren to stop further access
                through that connection, or remove Auvren&rsquo;s access in
                your Google Account&rsquo;s third-party connections settings.
                Turning off inbox checks stops recurring scanning but leaves
                the connection available for searches you request. To
                request deletion of Gmail data held by Auvren, including
                imported documents and related records, contact{" "}
                <a href="mailto:hello@atg.science">hello@atg.science</a>. We
                may need to verify your identity. We will explain any
                information that must be retained for legal or regulatory
                obligations; removing Google access alone does not delete
                these records.
              </p>
            </SubSection>

            <SubSection title="Sharing and human access">
              <p>
                Google user data is shared only as permitted by
                Google&rsquo;s Limited Use requirements: with your consent to
                provide the visible features you use, for security purposes,
                to comply with applicable law, or as part of a business
                transfer with your explicit prior consent. Human access is
                limited to your explicit agreement to review specific data,
                security needs, legal requirements, or aggregated and
                anonymized internal operations permitted by Google&rsquo;s
                policy. These restrictions also apply to information derived
                from Gmail.
              </p>
            </SubSection>

            <SubSection title="Limits on use">
              <p>
                We do not sell Google user data, use it for advertising, or
                use it to determine creditworthiness or for lending purposes.
                These limits apply to Gmail data and information derived from
                it, even where other sections of this website policy describe
                broader uses of website information.
              </p>
            </SubSection>

            <p>
              Auvren&rsquo;s use of information received from Google APIs will
              adhere to the Google API Services User Data Policy, including
              the Limited Use requirements.
            </p>
            <p>
              <a href="https://developers.google.com/terms/api-services-user-data-policy">
                Google API Services User Data Policy
              </a>
            </p>
            <p>
              <a href="https://myaccount.google.com/connections">
                Manage access in your Google Account
              </a>
            </p>
          </Section>

          <Section title="Auvren Website Privacy Policy">
            <p>
              This Privacy Policy is designed to help you understand how
              Auvren and its related organizations and affiliates
              (&ldquo;Auvren&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or
              &ldquo;our&rdquo;), collects, uses and shares personal
              information collected through this website. We value your
              privacy, and we will not share your personal information with
              third parties except as described in this Policy without your
              consent.
            </p>
            <p>
              <strong>
                BY USING THIS SITE, YOU AGREE TO BE BOUND BY THIS POLICY. IF
                YOU DO NOT AGREE WITH ANY OF THE TERMS OF THE POLICY, PLEASE
                DO NOT USE THIS WEBSITE OR PROVIDE US WITH YOUR INFORMATION.
              </strong>
            </p>
          </Section>

          <Section title="What this Policy Covers">
            <p>
              This Policy applies to our collection, use and sharing of your
              personal information when you visit our website and its
              related sites (the &ldquo;Site&rdquo;), receive our
              communications, or participate in our online activities or
              events. This Policy applies only to information gathered as
              described above and does not apply to any other information or
              websites not owned or operated by us or information collected
              by us by other means. We may have additional policies governing
              our collection for your personal information by other means,
              for example, if you create an account with us or otherwise
              engage us to provide financial services, and we will make
              additional terms available to you at that time.
            </p>
          </Section>

          <Section title="Personal Information We Collect">
            <p>
              This section of our Policy describes the categories of personal
              information we collect about you and the different ways in
              which we collect your personal information.
            </p>
            <p>
              <strong>Information You Give Us.</strong> Personal information
              you may provide through the Site or otherwise communicate to us
              includes:
            </p>
            <ul>
              <li>
                <strong>Contact information.</strong> We collect information
                about you when you provide contact information to us via
                email or through the Site, including as a result of joining
                our waitlist for product announcements. This information may
                include your first and last name, email address, mailing
                address, phone number.
              </li>
              <li>
                <strong>Correspondence.</strong> We may collect personal
                information you provide when you request information,
                respond to surveys, or otherwise correspond with us.
              </li>
              <li>
                <strong>Other information.</strong> We may collect other
                information from you that is not specifically listed here.
                We may use such information in accordance with this Policy.
              </li>
            </ul>
            <p>
              <strong>Information Automatically Collected.</strong> Our
              servers and third party service providers may automatically
              record cookie information in connection with your use of the
              Site, which includes information such as your Internet Protocol
              (IP) address, device and browser type, operating system, DNS,
              the pages or features of the Site that you browsed and the time
              spent on those pages or features, the frequency with which you
              use the Site, the links that you click on or use, and other
              statistics. We may use this information to gain a better
              understanding of the users of our Site, to improve our Site,
              and to improve our services. We collect this information in
              server logs and by using cookies and similar tracking
              technologies. See our Cookie Policy, below, for more
              information.
            </p>
          </Section>

          <Section title="How We Use Your Personal Information">
            <p>
              This section of our Policy describes the different purposes for
              which we may use the personal information we collect about
              you.
            </p>
            <p>
              <strong>
                To Provide our Products and Services and Communicate With
                You.
              </strong>{" "}
              We use your contact information, cookie information, and other
              personal information to:
            </p>
            <ul>
              <li>provide you with our products and services;</li>
              <li>
                register you for our waitlist and allow you to track your
                waitlist status; and
              </li>
              <li>
                to respond to your requests, questions, comments, and
                feedback.
              </li>
            </ul>
            <p>
              <strong>To Improve our Site.</strong> We use your cookie
              information to:
            </p>
            <ul>
              <li>provide, maintain and improve the Site;</li>
              <li>
                better understand your needs and interests, and personalize
                your experience with the Site; and
              </li>
              <li>perform website analytics and database management services.</li>
            </ul>
            <p>
              <strong>To Send You Marketing Communications.</strong> We may
              use your contact information to send you newsletters, product
              launch information or other marketing communications, but you
              may opt out of receiving them as described in the Your Choices
              section below.
            </p>
            <p>
              <strong>For Compliance, Fraud Prevention and Safety.</strong> We
              may use some or all of your personal information as we believe
              appropriate to: (a) investigate or prevent violation of the law
              or your agreements with us; (b) protect our, your or
              others&rsquo; rights, privacy, safety or property (including by
              prosecuting and defending legal claims); (c) protect,
              investigate and deter against fraudulent, harmful, unauthorized,
              unethical or illegal activity; (d) comply with applicable laws,
              lawful requests and legal process, such as to respond to
              subpoenas or requests from government authorities; and (e)
              where permitted by law in connection with a legal
              investigation. For example, we may share information with law
              enforcement to reduce the risk of fraud or if someone uses or
              attempts to use our site for illegal reasons.
            </p>
            <p>
              <strong>With Your Consent.</strong> In some cases, we may ask
              for your consent to collect, use, or share your personal
              information.
            </p>
          </Section>

          <Section title="How We Share your Personal Information">
            <p>
              This section of our Policy describes the categories of personal
              information we share with third parties and the types of third
              parties with whom we share that information. We do not sell
              your personal information; however, we may share your personal
              information with third parties for a number of reasons. For
              example, we may use third parties to help us design and
              operate the Site, provide services to support the Site, help us
              analyze our data, or send information on our behalf about
              services and events in which you may be interested. Unless
              otherwise indicated at the time we collect your information, if
              we allow third parties to access the personal information we
              collect, we will have contractual provisions or other
              appropriate protections in place to ensure such access is for
              limited purposes and in compliance with this Policy.
              Specifically, we share your personal information with the
              following categories of third parties:
            </p>
            <p>
              <strong>Related and Affiliated Organizations.</strong> We may
              share all of the personal information we collect about you
              with our affiliates and related organizations for use
              consistent with this Policy.
            </p>
            <p>
              <strong>Service Providers.</strong> We may share your personal
              information with third party companies and individuals as
              needed for them to provide us with services that help us with
              our business activities and to promote our services to you.
              This information may include your contact information and
              cookie information.
            </p>
            <p>
              <strong>Compliance, Fraud Prevention and Safety.</strong> We may
              disclose some or all of the personal information we have
              collected about you as we believe appropriate to government or
              law enforcement officials or private parties for the purposes
              described above under the section &ldquo;For Compliance, Fraud
              Prevention and Safety.&rdquo;
            </p>
            <p>
              <strong>Business Transfers.</strong> We may sell, transfer or
              otherwise share some or all of our business or assets,
              including all of the personal information we have collected
              about you, in connection with a business deal (or potential
              business deal) such as a merger, consolidation, acquisition,
              reorganization or sale of assets, or in the event of
              bankruptcy.
            </p>
          </Section>

          <Section title="Your Choices">
            <p>
              This section of our Policy describes your choices with respect
              to the personal information you provide and the marketing
              communications you may receive.
            </p>
            <p>
              <strong>Opt Out of Communications.</strong> You may opt out of
              marketing-related emails by following the opt-out prompt in the
              email. To opt out of other forms of marketing communications,
              including to be removed from product launch waitlists, please
              contact us using the contact information provided at the end
              of this Policy.
            </p>
            <p>
              <strong>
                Consequences of Not Providing Personal Information.
              </strong>{" "}
              You are not required to provide all personal information
              identified in this Policy to use our Site or to interact with
              us offline, but certain functionality will not be available if
              you do not provide personal information. For example, if you
              do not provide personal information, we may not be able to
              respond to your request, perform a transaction with you, or
              provide you with marketing that we believe you would find
              valuable.
            </p>
          </Section>

          <Section title="Cookie Policy">
            <p>
              This section of our Policy describes how we and our business
              partners may collect and store information about you and your
              use of the Site through cookies and other tracking
              technologies.
            </p>
            <p>
              <strong>What are Cookies?</strong> Cookies are small data files
              that are placed on your computer or mobile device when you
              visit a website. Cookies set by the website are called
              &ldquo;first party cookies&rdquo;. Cookies set by parties other
              than the website are called &ldquo;third party cookies&rdquo;.
              Third party cookies enable third party features or
              functionality, such as advertising or website analytics, to be
              provided on or through the website. The parties that set these
              third-party cookies can recognize your computer or device both
              when it visits the website in question and also when it visits
              certain other websites and/or mobile apps.
            </p>
            <p>
              <strong>
                What Cookies and Other Tracking Technologies do We Use?
              </strong>{" "}
              We use several different kinds of cookies on this Site,
              including strictly necessary cookies, which are cookies that
              are necessary for the Site to function and cannot be switched
              off in our systems; performance cookies, which allow us to
              count visits and traffic sources so we can measure and improve
              the performance of our Site; and functional cookies, which
              enable the Site to provide enhanced functionality and
              personalization.
            </p>
            <p>
              Cookies are not the only way to track visitors to a website. We
              may use similar technologies from time to time, like web
              beacons (sometimes called &ldquo;tracking pixels&rdquo; or
              &ldquo;clear gifs&rdquo;). These are tiny graphics files that
              contain a unique identifier that enable us to recognize when
              someone has visited our Sites. These technologies often depend
              on cookies to function properly, and so disabling cookies may
              impair their functioning. If you sign up to receive our
              e-mails, we may also use cookies in conjunction with these
              emails. When your browser downloads any graphic content in the
              e-mail, we will also place a cookie on your computer that will
              tell us if you come to our website at a later date.
            </p>
            <p>
              In addition to our own cookies, we may collaborate with various
              third-party service providers who also use cookies to help us
              optimize our website, and to understand more about the
              visitors to our website. For example, we use{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                PostHog
              </a>{" "}
              to provide us with demographic information about our visitors
              and to help us analyze how people use our website. To learn
              more about how PostHog uses cookies, please click the link
              above or visit its website to view its privacy policy.
            </p>
            <p>
              <strong>
                How Can You Disable Cookies and Other Tracking Technology?
              </strong>{" "}
              Depending on the type of browser and device that you use, you
              may have the ability to control the type of information that
              these tools use. To do this, follow the instructions in your
              browser settings. Many browsers accept cookies by default
              until you change your settings. For more information about
              cookies, including how to see what cookies have been set on
              your computer or mobile device and how to manage and delete
              them, visit{" "}
              <a
                href="http://www.allaboutcookies.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.allaboutcookies.org
              </a>{" "}
              and{" "}
              <a
                href="http://www.youronlinechoices.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.youronlinechoices.com
              </a>
              . Some Internet browsers also may be configured to send
              &ldquo;Do Not Track&rdquo; or &ldquo;Global Privacy
              Control&rdquo; signals to the online services that you visit.
              Because we do not engage in targeted advertising or other
              cross-contextual behavioral tracking, we currently do not
              respond to &ldquo;Do Not Track&rdquo; or similar signals. To
              find out more about &ldquo;Do Not Track,&rdquo; please visit{" "}
              <a
                href="http://www.allaboutdnt.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                http://www.allaboutdnt.com
              </a>
              .
            </p>
          </Section>

          <Section title="Other Important Privacy Information">
            <p>
              <strong>Third Party Sites and Services.</strong> The Site may
              contain links to other websites and services operated by third
              parties. These links are not an endorsement of, or
              representation that we are affiliated with, any third party.
              We do not control third party websites, applications or
              services, and we are not responsible for their actions. Other
              websites and services follow different rules regarding their
              collection, use and sharing of your personal information. We
              encourage you to read their privacy policies to learn more.
            </p>
            <p>
              <strong>Security.</strong> The security of your personal
              information is important to us. We take a number of
              organizational, technical and physical measures that are
              designed to protect the personal information we collect.
              However, security risk is inherent in all internet and
              information technologies, and we cannot guarantee the absolute
              security of your personal information.
            </p>
            <p>
              <strong>
                International Data Use and Cross-Border Transfers.
              </strong>{" "}
              We are located in the United States and have affiliates and
              service providers in other countries, and your personal
              information may be collected, used and stored in the United
              States or other locations outside of your home country.
              Privacy laws in the locations where we handle your personal
              information may not be as protective as the privacy laws in
              your home country. However, we will handle your personal
              information in accordance with this Policy regardless of where
              your personal information is kept. If you reside in other
              non-US jurisdictions, your use of the Site or provision of any
              personal information constitutes your consent for the transfer
              of such data to the United States for the purposes identified
              in this Policy. If you have questions about cross-border
              transfers, please contact us as detailed at the end of this
              Policy.
            </p>
            <p>
              <strong>
                Verifying, Changing, and Deleting Your Information.
              </strong>{" "}
              You can contact us as detailed below and ask us to change,
              update or fix your information in certain cases, particularly
              if it is inaccurate. You can also request that we erase or
              delete all or some of your personal information or otherwise
              object to, limit, or restrict the use of such information (if
              we have no legal right or legitimate business interest in
              retaining such information).
            </p>
            <p>
              <strong>Children.</strong> The Site is not intended for use by
              anyone under the age of 18, nor do we knowingly collect or
              solicit personal information from anyone under the age of 18.
              If you are under 18, you should not attempt to use the Site or
              send any information about yourself to us.
            </p>
          </Section>

          <Section title="Changes to this Policy">
            <p>
              We reserve the right to modify this Policy at any time. If we
              make changes to this Policy, we will post them on the Site and
              indicate the effective date of the change. If we make material
              changes to this Policy we will notify you by email or through
              the Site.
            </p>
          </Section>

          <Section title="How to Contact Us">
            <p>
              <a href="mailto:hello@atg.science">hello@atg.science</a>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
