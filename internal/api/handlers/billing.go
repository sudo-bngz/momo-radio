package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"momo-radio/internal/config"
	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/billingportal/session"
	checkoutsession "github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/customer"
	"github.com/stripe/stripe-go/v76/webhook"
	"gorm.io/gorm"
)

type BillingHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewBillingHandler(db *gorm.DB, cfg *config.Config) *BillingHandler {
	stripe.Key = cfg.Stripe.SecretKey
	return &BillingHandler{db: db, cfg: cfg}
}

// CreateCheckout initiates the Stripe Checkout flow
func (h *BillingHandler) CreateCheckout(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var org models.Organization
	if err := h.db.First(&org, "id = ?", orgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// 1. Create Stripe Customer if one doesn't exist
	if org.StripeCustomerID == "" {
		params := &stripe.CustomerParams{
			Name: stripe.String(org.Name),
			Metadata: map[string]string{
				"org_id": orgID.String(),
			},
		}
		cust, err := customer.New(params)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create billing profile"})
			return
		}
		org.StripeCustomerID = cust.ID
		h.db.Save(&org)
	}

	// 2. Create the Checkout Session
	params := &stripe.CheckoutSessionParams{
		Customer: stripe.String(org.StripeCustomerID),
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(h.cfg.Stripe.ProPriceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(h.cfg.Stripe.SuccessURL),
		CancelURL:  stripe.String(h.cfg.Stripe.CancelURL),
	}

	s, err := checkoutsession.New(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": s.URL})
}

// CreatePortal creates a Customer Portal session for managing subscriptions
func (h *BillingHandler) CreatePortal(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var org models.Organization
	h.db.First(&org, "id = ?", orgID)

	if org.StripeCustomerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No active billing profile"})
		return
	}

	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(org.StripeCustomerID),
		ReturnURL: stripe.String(h.cfg.Stripe.CancelURL), // Return to settings page
	}

	ps, err := session.New(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": ps.URL})
}

// HandleWebhook asynchronously updates the database
func (h *BillingHandler) HandleWebhook(c *gin.Context) {
	const MaxBodyBytes = int64(65536)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxBodyBytes)
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusServiceUnavailable)
		return
	}

	event, err := webhook.ConstructEvent(payload, c.GetHeader("Stripe-Signature"), h.cfg.Stripe.WebhookSecret)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	switch event.Type {
	case "checkout.session.completed":
		var session stripe.CheckoutSession
		json.Unmarshal(event.Data.Raw, &session)

		h.db.Model(&models.Organization{}).
			Where("stripe_customer_id = ?", session.Customer.ID).
			Updates(map[string]interface{}{
				"stripe_subscription_id": session.Subscription.ID,
				"plan_tier":              "pro",
				"billing_status":         "active",
			})

	case "customer.subscription.deleted", "customer.subscription.updated":
		var sub stripe.Subscription
		json.Unmarshal(event.Data.Raw, &sub)

		status := sub.Status // e.g., 'active', 'past_due', 'canceled'
		tier := "pro"
		if status == stripe.SubscriptionStatusCanceled {
			tier = "free"
		}

		h.db.Model(&models.Organization{}).
			Where("stripe_subscription_id = ?", sub.ID).
			Updates(map[string]interface{}{
				"billing_status": status,
				"plan_tier":      tier,
			})
	}

	c.Status(http.StatusOK)
}
